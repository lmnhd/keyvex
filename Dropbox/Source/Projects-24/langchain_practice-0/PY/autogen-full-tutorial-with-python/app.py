from autogen import AssistantAgent, UserProxyAgent
from dotenv import get_key

api_key = get_key('.env','OPENAI_API_KEY')
#print api key to console
print(api_key)

config_list = [
    {
        'model': 'gpt-3.5-turbo',
        'api_key': api_key
    }
]

llm_config={
   # "request_timeout": 600,
    "seed": 42,
    "config_list": config_list,
    "temperature": 0
}

assistant = AssistantAgent(
    name="assistant",
    llm_config=llm_config
)


user_proxy = UserProxyAgent(
    name="user_proxy",
    human_input_mode="NEVER",
    max_consecutive_auto_reply=5,
    is_termination_msg=lambda x: x.get("content", "").rstrip().endswith("TERMINATE"),
    code_execution_config={"work_dir": "web"},
    #code_execution_config=False,
    llm_config=llm_config,
    system_message="""Reply TERMINATE if the task has been solved at full satisfaction, otherwise, reply CONTINUE, or the reason why the task is not solved yet."""
)

task = """
Write python code to output numbers 1 to 100, and then store the code in a file"""

user_proxy.initiate_chat(
    assistant,
    message=task,
    max_turns=2
)

task2 = """
Change the code int the file you just created to instead output numbers from 50 to 150"""

user_proxy.initiate_chat(
    assistant,
    message=task2,
)