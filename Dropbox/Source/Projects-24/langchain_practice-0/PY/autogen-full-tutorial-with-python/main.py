import os
from autogen import ConversableAgent

cathy = ConversableAgent(
    "Cathy",
    system_message="Your name is Cathy and you are part of a duo of comedians.",
    llm_config={"config_list": [{"model": "gpt-3.5-turbo", "api_key": os.getenv("OPENAI_API_KEY")}]},
    human_input_mode="NEVER"
)

joe = ConversableAgent(
    "Joe",
    system_message="Your name is Joe and you are part of a duo of comedians.",
    llm_config={"config_list": [{"model": "gpt-3.5-turbo", "api_key": os.getenv("OPENAI_API_KEY")}]},
    max_consecutive_auto_reply=1,
    is_termination_msg=lambda msg: "good bye" in msg["content"].lower(),
)

result = joe.initiate_chat(cathy, message="Cathy, tell me a joke and then say the words GOOD BYE.")