import os
from typing import Annotated
import autogen
import requests

gpt4_config = {
    "cache_seed": 46,  # change the cache_seed for different trials
    "temperature": 0,
    "config_list": [
        {"model": "gpt-3.5-turbo", "api_key": os.environ["OPENAI_API_KEY"]}
    ],
    "timeout": 120,
}


search_bot = autogen.AssistantAgent(
    name="search_bot",
    system_message="For tasks, only use the functions you have been provided. Reply TERMINATE when the task is done.",
    llm_config=gpt4_config,
)

# create a UserProxyAgent instance named "user_proxy"
user_proxy = autogen.UserProxyAgent(
    name="user_proxy",
    system_message="You take simple information like the name of the ship and the sail date get the raw data using bing_search_tool, then summarize the itinerary, destination, amenities,links, and price information about the given query about a Cruise.",
    is_termination_msg=lambda x: x.get("content", "") and x.get("content", "").rstrip().endswith("TERMINATE"),
    human_input_mode="NEVER",
    max_consecutive_auto_reply=10,
    code_execution_config={"work_dir": "coding"},
)

# define functions according to the function description


# An example sync function registered using register_function
def bing_search(
    search_term: Annotated[str, "The search term or phrase to search"],
    max_results: Annotated[
        int, "Optional number of results needed - defaults to 2"
    ] = 2,
) -> str:
    """Gets the search results for a query using the Bing Search API.
    Args:
        search_term (str): The search query
        max_results (int, optional): Maximum number of results to return

    returns:
        str: The list of results as a string
    """
    search_url = "https://api.bing.microsoft.com/v7.0/search"
    headers = {"Ocp-Apim-Subscription-Key":  os.environ.get("BING_SEARCH_API_KEY") }
    params = {
        "q": search_term,
        "textDecorations": True,
        "textFormat": "HTML",
        "count": max_results,
    }
    response = requests.get(search_url, headers=headers, params=params)
    response.raise_for_status()
    return response.text


autogen.agentchat.register_function(
    bing_search,
    caller=search_bot,
    executor=user_proxy,
    description="search for information on a given query using the bing search API",
)

# result = user_proxy.initiate_chat(search_bot, message="get the info for Vision of the Seas Jan. 24, 2025")
result = user_proxy.initiate_chat(search_bot, message="get the info for Vision of the Seas Jan. 24, 2025")
#print('result', result)