from openai import OpenAI
client = OpenAI()

response = client.images.generate(
  model="dall-e-3",
  #prompt="The sun setting over the bow of a cruise ship in the Caribbean, palm trees off in the distance and the moons reflection on the ocean causing a bright glare",
  prompt="The oval office at night with the moon shining through the windows illuminating the American flag and a silhouette of the president sitting at his desk thinking",
  size="1792x1024",
  quality="standard",
  n=1,
)

image_url = response.data[0].url

print(f"Generated image URL: {image_url}")

#https://oaidalleapiprodscus.blob.core.windows.net/private/org-oYKPrLxKmw0ud9PTEIRG8c7i/user-5SqeVPnQgyd2IVMR4BRkIntf/img-3lOg5Ixv5DA71DV1x5yob3SK.png?st=2024-04-08T19%3A20%3A55Z&se=2024-04-08T21%3A20%3A55Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=6aaadede-4fb3-4698-a8f6-684d7786b067&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2024-04-08T10%3A16%3A22Z&ske=2024-04-09T10%3A16%3A22Z&sks=b&skv=2021-08-06&sig=wQrerz37lH3sMCxIAQ5ltuq9fMipw%2BQwNdubMvHUMnY%3D
#https://oaidalleapiprodscus.blob.core.windows.net/private/org-oYKPrLxKmw0ud9PTEIRG8c7i/user-5SqeVPnQgyd2IVMR4BRkIntf/img-H6KDrCKxeB5GVwHofnsvCmFC.png?st=2024-04-08T20%3A14%3A17Z&se=2024-04-08T22%3A14%3A17Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=6aaadede-4fb3-4698-a8f6-684d7786b067&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2024-04-08T00%3A00%3A42Z&ske=2024-04-09T00%3A00%3A42Z&sks=b&skv=2021-08-06&sig=07mg2Dv2u34M7AsdODh4KfF6Zbqnvl3gp3MycFinngw%3D