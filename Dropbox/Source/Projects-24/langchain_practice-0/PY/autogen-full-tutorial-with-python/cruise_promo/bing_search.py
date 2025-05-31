import os
from typing import Annotated
import requests
import autogen


# print(bing_search("Celebrity Infinity Jan. 2, 2025"))
# print(bing_assistant_proxy.initiate_chat(coder, message="'Quantum of the Seas May 12, 2025'"))
llm_config = {
    "config_list": [{"model": "gpt-3.5-turbo", "api_key": os.environ["OPENAI_API_KEY"]}]
}
subscription_key = os.environ.get("BING_SEARCH_API_KEY")  #
coder = autogen.AssistantAgent(
    name="bing_search_tool",
    system_message="For all requests, only use the functions you have been provided. You have a bing_search tool that can be used to get information for a query. Reply TERMINATE when the task is done. ",
    llm_config=llm_config,
)

# create a UserProxyAgent instance named "user_proxy"
bing_assistant_proxy = autogen.AssistantAgent(
    name="bing_assistant_proxy",
    system_message="You take simple information like the name of the ship and the sail date get the raw data using bing_search_tool, then summarize the itinerary, destination, amenities,links, and price information about the given query about a Cruise."
    "IMPORTANT: If you cannot find any relevant info reply with the reason why you cannot find it. If you find the info, reply with the summary of the info. If you find the info but it is not complete, reply with the summary of the info and the reason why it is incomplete. If you find the info and it is complete, reply with the summary of the info and 'TERMINATE'.",
    is_termination_msg=lambda x: x.get("content", "")
    and x.get("content", "").rstrip().endswith("TERMINATE"),
    human_input_mode="ALWAYS",
    max_consecutive_auto_reply=3,
    llm_config=llm_config,
    code_execution_config={"work_dir": "coding"},
)


print(subscription_key)
assert subscription_key

search_url = "https://api.bing.microsoft.com/v7.0/search"


@bing_assistant_proxy.register_for_execution()
@coder.register_for_llm(description="search a query using bing search api.")
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
    headers = {"Ocp-Apim-Subscription-Key": subscription_key}
    params = {
        "q": search_term,
        "textDecorations": True,
        "textFormat": "HTML",
        "count": max_results,
    }
    response = requests.get(search_url, headers=headers, params=params)
    response.raise_for_status()
    return response.text

    return bing_assistant_proxy


# print(bing_assistant_proxy.initiate_chat(coder, message="'Vision of the Seas Jan. 24, 2025'"))


# print(
#     bing_assistant_proxy.generate_tool_calls_reply(
#         messages=[{"role": "user", "content": "Vision of the Seas Jan. 24, 2025"}]
#     )
# )
