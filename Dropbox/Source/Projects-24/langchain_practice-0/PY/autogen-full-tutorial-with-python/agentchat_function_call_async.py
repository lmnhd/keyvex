import time
import os
from bs4 import BeautifulSoup
from typing_extensions import Annotated, List

import autogen
from autogen.cache import Cache
import requests
from youtube_transcript_api import YouTubeTranscriptApi

llm_config = {
    "config_list": [{"model": "gpt-4", "api_key": os.environ["OPENAI_API_KEY"]}]
}

coder = autogen.AssistantAgent(
    name="chatbot",
    system_message="For all requests, only use the functions you have been provided. You have a youtube_video_transcription tool that can be used to get the transcription of a video corresponding to a link. Reply TERMINATE when the task is done. ",
    llm_config=llm_config,
)

# create a UserProxyAgent instance named "user_proxy"
user_proxy = autogen.UserProxyAgent(
    name="user_proxy",
    system_message="A proxy for the user making the request.",
    is_termination_msg=lambda x: x.get("content", "")
    and x.get("content", "").rstrip().endswith("TERMINATE"),
    human_input_mode="NEVER",
    max_consecutive_auto_reply=1,
    code_execution_config={"work_dir": "coding"},
)

# define functions according to the function description

# An example async function registered using register_for_llm and register_for_execution decorators


@user_proxy.register_for_execution()
@coder.register_for_llm(description="get a transcript from a youtube video link")
def get_youtube_transcription(video_id: str, languages: list = ['en']) -> list:
    """
    Fetches the transcript for a given YouTube video.

    Args:
        video_id (str): The YouTube video ID.
        languages (list): List of language codes (optional, defaults to English).

    Returns:
        list: A list of dictionaries containing transcript information.
    """
    try:
        transcripts = YouTubeTranscriptApi.get_transcript(video_id, languages=languages)
        return transcripts
    except Exception as e:
        print(f"Error fetching transcript: {e}")
        return []

# Example usage
# if __name__ == "__main__":
#     video_id = "YOUR_YOUTUBE_VIDEO_ID"  # Replace with the actual video ID
#     transcripts = get_youtube_transcription(video_id)
#     if transcripts:
#         for entry in transcripts:
#             print(f"Text: {entry['text']} (Start: {entry['start']:.2f}, Duration: {entry['duration']:.2f})")
#     else:
#         print("No transcript found.")

# Test youtube_transcription tool
if __name__ == "__main__":
    video_id = "sPzc6hMg7So"  # Replace with the actual video ID
    transcripts = get_youtube_transcription(video_id)
    if transcripts:
        for entry in transcripts:
            print(f"Text: {entry['text']} (Start: {entry['start']:.2f}, Duration: {entry['duration']:.2f})")
    else:
        print("No transcript found.")

# An example sync function registered using register_function
# with Cache.disk() as cache: 

#    result = user_proxy.initiate_chat(  # noqa: F704
#         coder,
#         message="Get me the transcript of this video: https://www.youtube.com/watch?v=sPzc6hMg7So&t=1175s",
#         cache=cache,
#         summary_method="reflection_with_llm"
#     )
   
#    print('result', result)
