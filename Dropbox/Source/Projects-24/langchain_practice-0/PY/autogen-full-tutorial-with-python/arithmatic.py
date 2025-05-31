import tempfile
from autogen import ConversableAgent

from num_agents import group_chat_manager_with_intros
import os

temp_dir = tempfile.gettempdir()



arithmetic_agent = ConversableAgent(
    name="Arithmetic_Agent",
    llm_config=False,
    human_input_mode="ALWAYS",
    code_execution_config={"use_docker": False, "work_dir": temp_dir}
)

code_writer_agent = ConversableAgent(
    name="Code_Writer_Agent",
    system_message='You are a code writer. You write Python script in Markdown code blocks.',
    llm_config={"config_list": [{"model": "gpt-3.5-turbo", "api_key": os.environ["OPENAI_API_KEY"]}]},
    human_input_mode="NEVER"
)

poetry_agent = ConversableAgent(
    name="Poetry_Agent",
    llm_config={"config_list": [{"model": "gpt-3.5-turbo", "api_key": os.environ["OPENAI_API_KEY"]}]},
    system_message="You are an AI poet.",
    human_input_mode="NEVER"
)
nested_chats = [
    {
        "recipient": group_chat_manager_with_intros,
        "summary_method": "reflection_with_llm",
        "summary_prompt": "Summarize the sequence of operations used to turn " "the source number into target number.",
    },
    {
        "recipient": code_writer_agent,
        "message": "Write a Python script to verify the arithmetic operations are correct.",
        "summary_method": "reflection_with_llm",
    },
    {
        "recipient": poetry_agent,
        "message": "Write a poem about it.",
        "max_turns": 1,
        "summary_method": "last_msg",
    },
]

arithmetic_agent.register_nested_chats(
    nested_chats,
    # The trigger function is used to determine if the agent should start the nested chat
    # given the sender agent.
    # In this case, the arithmetic agent will not start the nested chats if the sender is
    # from the nested chats' recipient to avoid recursive calls.
    trigger=lambda sender: sender not in [group_chat_manager_with_intros, code_writer_agent, poetry_agent],
)

# Instead of using `initiate_chat` method to start another conversation,
# we can use the `generate_reply` method to get single reply to a message directly.
reply = arithmetic_agent.generate_reply(
    messages=[{"role": "user", "content": "I have a number 3 and I want to turn it into 7."}]
)

print('reply', reply)