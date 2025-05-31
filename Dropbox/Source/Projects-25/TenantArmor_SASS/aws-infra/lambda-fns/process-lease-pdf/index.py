import fitz  # PyMuPDF
import boto3
import json
import os
import requests
import urllib.parse
import datetime

# Environment variables (set in Lambda configuration)
LEASE_ANALYSES_TABLE_NAME = os.environ.get('LEASE_ANALYSES_TABLE_NAME')
NEXTJS_API_ENDPOINT_FOR_LAMBDA = os.environ.get('NEXTJS_API_ENDPOINT_FOR_LAMBDA')

# s3_client = boto3.client('s3')
# dynamodb_client = boto3.resource('dynamodb')

def handler(event, context):
    s3_client = boto3.client('s3')
    dynamodb_client = boto3.resource('dynamodb')

    print("Lambda triggered by S3 event:", json.dumps(event))

    if not LEASE_ANALYSES_TABLE_NAME or not NEXTJS_API_ENDPOINT_FOR_LAMBDA:
        print("Error: Environment variables LEASE_ANALYSES_TABLE_NAME or NEXTJS_API_ENDPOINT_FOR_LAMBDA not set.")
        return {'statusCode': 500, 'body': json.dumps({'error': 'Lambda configuration error.'})}

    table = dynamodb_client.Table(LEASE_ANALYSES_TABLE_NAME)
    analysis_id_from_metadata = None # Initialize to ensure it's defined in error scope
    s3_object_key = 'unknown_s3_key_on_error' # Default for error reporting
    bucket_name = 'unknown_bucket_on_error'   # Default for error reporting

    try:
        bucket_name = event['Records'][0]['s3']['bucket']['name']
        s3_object_key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'])

        print(f"Processing file: s3://{bucket_name}/{s3_object_key}")

        # Extract metadata set by the Next.js upload API
        user_id = 'unknown_user_metadata_error'
        user_selected_state = 'unknown_state_metadata_error'
        original_filename = s3_object_key.split('/')[-1]
        document_type = 'LEASE' # Default, can be overridden by metadata if needed

        try:
            head_object = s3_client.head_object(Bucket=bucket_name, Key=s3_object_key)
            metadata = head_object.get('Metadata', {})
            print(f"Full S3 metadata dictionary received by Lambda: {json.dumps(metadata)}")
            
            analysis_id_from_metadata = metadata.get('analysis-id') # Key from Next.js
            user_id = metadata.get('user-id', user_id)
            user_selected_state = metadata.get('user-selected-state', user_selected_state)
            original_filename = metadata.get('original-filename', original_filename)
            # document_type = metadata.get('document-type', document_type) # If you plan to pass this too

            if not analysis_id_from_metadata:
                print("CRITICAL ERROR: 'analysis-id' not found in S3 metadata!")
                # This is a non-recoverable error for this flow
                raise ValueError("Missing 'analysis-id' in S3 metadata, cannot proceed.")
            
            print(f"Extracted Metadata: analysisId={analysis_id_from_metadata}, userId={user_id}, state={user_selected_state}, filename={original_filename}")
        except Exception as e:
            print(f"Error fetching or parsing S3 metadata: {e}")
            # If analysis_id_from_metadata is still None, we can't update the correct DDB item
            if not analysis_id_from_metadata:
                 raise # Re-raise if we don't have the ID to update DynamoDB
            # If we have the ID, we can try to update DDB with this specific error
            table.update_item(
                Key={'analysisId': analysis_id_from_metadata},
                UpdateExpression="SET #status = :s, #errorDetails = :e, #lastUpdated = :lu",
                ExpressionAttributeNames={
                    "#status": "status", 
                    "#errorDetails": "errorDetails", 
                    "#lastUpdated": "lastUpdatedTimestamp"
                },
                ExpressionAttributeValues={
                    ":s": "FAILED", 
                    ":e": f"S3 metadata retrieval/parsing error: {str(e)}", 
                    ":lu": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
            )
            raise # Re-raise to report the failure of the Lambda

        # Get PDF from S3
        pdf_object = s3_client.get_object(Bucket=bucket_name, Key=s3_object_key)
        pdf_content = pdf_object['Body'].read()

        # Extract text using PyMuPDF
        doc = fitz.open(stream=pdf_content, filetype="pdf")
        extracted_text = "".join([page.get_text() for page in doc])
        doc.close()

        current_time_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        if not extracted_text.strip():
            print("Warning: No text extracted from PDF. It might be an image-based PDF.")
            table.update_item(
                Key={'analysisId': analysis_id_from_metadata},
                UpdateExpression="SET #status = :s, #errorDetails = :e, #lastUpdated = :lu",
                ExpressionAttributeNames={
                    "#status": "status", 
                    "#errorDetails": "errorDetails", 
                    "#lastUpdated": "lastUpdatedTimestamp"
                },
                ExpressionAttributeValues={
                    ":s": "FAILED", 
                    ":e": "No text could be extracted. The PDF might be image-based or empty.", 
                    ":lu": current_time_iso
                }
            )
            return {'statusCode': 400, 'body': json.dumps({'error': 'No text extracted from PDF.'})}

        print(f"Text extracted successfully. Length: {len(extracted_text)}")

        # Update DynamoDB with extracted text and new status
        # Note: extractedText is now part of the payload to Next.js, not stored in DDB by Lambda directly
        # unless specifically required. This avoids DDB item size limits.
        update_expression = "SET #status = :s, #lastUpdated = :lu, #s3Key = :sk, #fileName = :fn, #userId = :uid, #userState = :ust"
        expression_attribute_values = {
            ':s': 'TEXT_EXTRACTION_COMPLETE',
            ':lu': current_time_iso,
            ':sk': s3_object_key, # Ensure these are updated if they could change or weren't set initially
            ':fn': original_filename,
            ':uid': user_id,
            ':ust': user_selected_state
        }
        expression_attribute_names = {
            "#status": "status", 
            "#lastUpdated": "lastUpdatedTimestamp",
            "#s3Key": "s3Key", 
            "#fileName": "fileName",
            "#userId": "userId", 
            "#userState": "userSelectedState"
        }

        # If you also wanted to store documentType from metadata:
        # update_expression += ", #docType = :dt"
        # expression_attribute_values[':dt'] = document_type
        # expression_attribute_names["#docType"] = "documentType"
        
        table.update_item(
            Key={'analysisId': analysis_id_from_metadata},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values
        )
        print(f"Successfully updated DynamoDB for TEXT_EXTRACTION_COMPLETE for analysisId: {analysis_id_from_metadata}")

        # Trigger Next.js API to start AI processing
        nextjs_payload = {
            'analysisId': analysis_id_from_metadata, # Use the UUID from metadata
            's3Bucket': bucket_name,
            's3Key': s3_object_key,
            'extractedText': extracted_text,
            'userSelectedState': user_selected_state
        }
        
        print(f"Calling Next.js API: {NEXTJS_API_ENDPOINT_FOR_LAMBDA} with payload for analysisId: {analysis_id_from_metadata}")
        # print(f"Extracted text sample (first 100 chars for API call log): {extracted_text[:100]}") # Keep for debugging if needed
        response = requests.post(NEXTJS_API_ENDPOINT_FOR_LAMBDA, json=nextjs_payload, timeout=30)
        response.raise_for_status() # Raises an HTTPError for bad responses (4XX or 5XX)
        
        print(f"Next.js API call successful: {response.status_code}, {response.text}")

        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Text extracted and AI processing initiated.', 'analysisId': analysis_id_from_metadata})
        }

    except Exception as e:
        print(f"Error processing file {s3_object_key} from bucket {bucket_name}: {e}")
        current_time_iso_error = datetime.datetime.now(datetime.timezone.utc).isoformat()
        error_message = str(e)
        
        # Attempt to update DynamoDB with FAILED status if analysis_id_from_metadata is available
        if analysis_id_from_metadata:
            try:
                table.update_item(
                    Key={'analysisId': analysis_id_from_metadata},
                    UpdateExpression="SET #status = :s, #errorDetails = :e, #lastUpdated = :lu",
                    ExpressionAttributeNames={
                        "#status": "status", 
                        "#errorDetails": "errorDetails", 
                        "#lastUpdated": "lastUpdatedTimestamp"
                    },
                    ExpressionAttributeValues={
                        ":s": "FAILED", 
                        ":e": error_message, 
                        ":lu": current_time_iso_error
                    }
                )
                print(f"Successfully updated DynamoDB with FAILED status for analysisId: {analysis_id_from_metadata} due to error: {error_message}")
            except Exception as db_error:
                print(f"Additionally, failed to update DynamoDB with error status for {analysis_id_from_metadata}: {db_error}")
        else:
            # If analysis_id_from_metadata was never retrieved, we can't update the correct item.
            # This scenario should be rare if S3 metadata upload works and 'analysis-id' is mandatory.
            print("Could not update DynamoDB with error status as analysis_id_from_metadata was not available.")
        
        return {
            'statusCode': 500,
            'body': json.dumps({'error': error_message, 'analysisIdAttempted': analysis_id_from_metadata if analysis_id_from_metadata else s3_object_key })
        }
    finally:
        # Ensure any S3 client objects are properly closed if necessary, though Boto3 often handles this.
        # For example, if you had a specific client object: s3_client.close() if hasattr(s3_client, 'close') else None
        pass # No explicit close needed for default Boto3 clients typically 