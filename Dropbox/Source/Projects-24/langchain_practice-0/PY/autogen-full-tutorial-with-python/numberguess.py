import os
import random
from autogen import ConversableAgent

agent_with_number = ConversableAgent(
    "agent_with_number",
    system_message="You are playing a game of guess-my-number. In the first game, you have the number 53 in your mind, and I will try to guess it. If I guess too high or too low, please reply with 'too high' or 'too low'.",
    llm_config={"config_list": [{"model": "gpt-3.5-turbo", "api_key": os.getenv("OPENAI_API_KEY")}]},
    max_consecutive_auto_reply=1,
    is_termination_msg=lambda msg: "53" in msg["content"],
    human_input_mode="TERMINATE"
)

agent_guess_number = ConversableAgent(
    "agent_guess_number",
    system_message="I have a number in my mind, and you will try to guess it. If I say 'too high' or 'too low', please reply with a new guess.",
    llm_config={"config_list": [{"model": "gpt-3.5-turbo", "api_key": os.getenv("OPENAI_API_KEY")}]},
    human_input_mode="NEVER"
)

human_proxy = ConversableAgent(
    "human_proxy",
    llm_config=False,
    human_input_mode="ALWAYS"
)

result = agent_with_number.initiate_chat(
    agent_guess_number,
    message="I have a number between 1 and 100. Guess what it is?"
    
)

# result = human_proxy.initiate_chat(
#     agent_with_number,
#     message="10"
# )

# result = agent_with_number.initiate_chat(
#     agent_guess_number,
#     message=f"I have a number between 1 and 100. Guess what it is?"
# )