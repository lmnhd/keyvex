import autogen
import os
from bs4 import BeautifulSoup
from typing_extensions import Annotated, List

import requests


gpt4_config = {
    "cache_seed": 46,  # change the cache_seed for different trials
    "temperature": 0,
    "config_list": [
        {"model": "gpt-3.5-turbo", "api_key": os.environ["OPENAI_API_KEY"]}
    ],
    "timeout": 120,
}
user_proxy = autogen.UserProxyAgent(
    name="Admin",
    system_message="A human admin. Interact with the planner to discuss the plan. Plan execution needs to be approved by this admin.",
    code_execution_config=False,
)
# engineer = autogen.AssistantAgent(
#     name="Engineer",
#     llm_config=gpt4_config,
#     system_message="""Engineer. You follow an approved plan. You write python/shell code to solve tasks. Wrap the code in a code block that specifies the script type. The user can't modify your code. So do not suggest incomplete code which requires others to modify. Don't use a code block if it's not intended to be executed by the executor.
# Don't include multiple code blocks in one response. Do not ask others to copy and paste the result. Check the execution result returned by the executor.
# If the result indicates there is an error, fix the error and output the code again. Suggest the full code instead of partial code or code changes. If the error can't be fixed or if the task is not solved even after the code is executed successfully, analyze the problem, revisit your assumption, collect additional info you need, and think of a different approach to try.
# """
# )


writer = autogen.AssistantAgent(
    name="Writer",
    llm_config=gpt4_config,
    system_message="""Writer. You work for a company called Leisure Life Vacations. You are able to write highly effective advertisement campaigns. Take the research about a cruise and create a witty ad to sell this cruise.  Do not mention prices.  Any links to websites provided are strictly for our research purposes and NOT TO BE PART OF THE AD! Make sure to mention the Company name 'Leisure Life Vacations' in the ad. Reply with TERMINATE when the task is complete.""",
    # system_message="""Writer. You work for a company called Leisure Life Vacations. You are able to write highly effective advertisement campaigns. If you receive a blank or imaginary report from planner just return 'I cannot write this garbage!' and 'TERMINATE'... otherwise, Take the research provided by the planner and create a witty ad to sell this cruise.  Do not mention prices. Any links to websites provided by the researcher are strictly for our research purposes and NOT TO BE PART OF THE AD!""",
)
planner = autogen.AssistantAgent(
    name="Planner",
    system_message="""Planner. Suggest a plan. The plan may involve a researcher to find useful information about cruises and a writer that can write clever ads for social media. Revise the plan based on feedback from admin, until admin approval.
Explain the plan first. Be clear which step is performed by the researcher, and which tool is being used.
""",
    llm_config=gpt4_config,
)
# planner = autogen.AssistantAgent(
#     name="Planner",
#     system_message="""Planner. Suggest a plan. The plan may involve a web researcher and an engineer to find useful information from the internet, a writer who can produce intriguing advertisements from select cruise information. Revise the plan based on feedback from admin, until admin approval.
# Explain the plan first. Be clear which step is performed by the researcher, which step is performed by the Writer, and which step is performed by the engineer.
# """,
#     llm_config=gpt4_config,
# )
executor = autogen.UserProxyAgent(
    name="Executor",
    system_message="Executor. Execute the function and report the result.",
    human_input_mode="NEVER",
    code_execution_config={
        "last_n_messages": 3,
        "work_dir": "paper",
        "use_docker": False,
    },  # Please set use_docker=True if docker is available to run the generated code. Using docker is safer than running the generated code directly.
    # The plan may involve an engineer who can write code and a scientist who doesn't write code.
)
researcher = autogen.AssistantAgent(
    name="Researcher",
    system_message="Researcher. You take basic cruise information like the name of the ship and departure date and use the bing_search tool to find all the details of the trip for the ad writer to write ads from. When you perform your research you follow these steps:"
    "1. Get the basic cruise info like ship name and date from planner"
    "2. Use bing_search tool to search for details on the cruise"
    "3. Summarize all the key details found in 1 paragraph and make sure to include locations, dates, amenities etc."
    "4. IMPORTANT: If you cannot find any relevant info reply with the reason why you cannot find it. If you find the info, reply with the summary of the info. If you find the info but it is not complete, reply with the summary of the info and the reason why it is incomplete. If you find the info and it is complete, reply with the summary of the info and 'TERMINATE'.",
    llm_config= {"config_list": [
        {"model": "gpt-3.5-turbo", "api_key": os.environ["OPENAI_API_KEY"]}
    ]},
)

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
    caller=researcher,
    executor=executor,
    description="search for information on a given query using the bing search API",
)

def state_transition(last_speaker, groupchat):
    messages = groupchat.messages

    if last_speaker is user_proxy:
        # init -> retrieve
        return planner
    elif last_speaker is planner:
        # retrieve: action 1 -> action 2
        return "auto"
    elif last_speaker is researcher:
            return executor
    elif last_speaker is executor:
        if messages[-1]["content"] == "exitcode: 1":
            # retrieve --(execution failed)--> retrieve
            return researcher
        else:
            # retrieve --(execution success)--> research
            return planner
    elif last_speaker == writer:
        # research -> end
        return user_proxy

groupchat = autogen.GroupChat(
    # agents=[user_proxy, engineer,researcher, writer, planner, executor],
    agents=[user_proxy, executor, researcher, planner, writer],
    messages=[],
    max_round=50,
    #send_introductions=True,
    speaker_selection_method=state_transition
)
manager = autogen.GroupChatManager(groupchat=groupchat, llm_config=gpt4_config, human_input_mode="TERMINATE")

# bing_assistant_proxy.generate_reply(
#     messages=[{"role": "user", "content": "Hello"}]
# )


# user_proxy.initiate_chat(
#     manager,
#     [{"role": "user", "content": "Write a facebook add for the following cruise: Radiance of the Seas on September 12 2025"}],
# )
user_proxy.initiate_chat(
    manager,
    message="""
Research the following cruise and write an ad that we can post on social media.:
Ship: Navigator of the seas, Sail date: Dec. 16, 2024
""",
)
