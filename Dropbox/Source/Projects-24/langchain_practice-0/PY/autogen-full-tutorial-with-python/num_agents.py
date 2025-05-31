from autogen import ConversableAgent, GroupChat
import os
# The Number Agent always returns the same numbers.

number_agent = ConversableAgent(
    name="Number_Agent",
    system_message="You return me the numbers I give you, one number each line.",
    llm_config={"config_list": [{"model": "gpt-3.5-turbo", "api_key": os.environ["OPENAI_API_KEY"]}]},
    human_input_mode="NEVER",
)

# The Adder Agent adds 1 to each number it receives.
adder_agent = ConversableAgent(
    name="Adder_Agent",
    system_message="You add 1 to each number I give you and return me the new numbers, one number each line.",
    llm_config={"config_list": [{"model": "gpt-3.5-turbo", "api_key": os.environ["OPENAI_API_KEY"]}]},
    human_input_mode="NEVER",
)

# The Multiplier Agent multiplies each number it receives by 2.
multiplier_agent = ConversableAgent(
    name="Multiplier_Agent",
    system_message="You multiply each number I give you by 2 and return me the new numbers, one number each line.",
    llm_config={"config_list": [{"model": "gpt-3.5-turbo", "api_key": os.environ["OPENAI_API_KEY"]}]},
    human_input_mode="NEVER",
)

# The Subtracter Agent subtracts 1 from each number it receives.
subtracter_agent = ConversableAgent(
    name="Subtracter_Agent",
    system_message="You subtract 1 from each number I give you and return me the new numbers, one number each line.",
    llm_config={"config_list": [{"model": "gpt-3.5-turbo", "api_key": os.environ["OPENAI_API_KEY"]}]},
    human_input_mode="NEVER",
)

# The Divider Agent divides each number it receives by 2.
divider_agent = ConversableAgent(
    name="Divider_Agent",
    system_message="You divide each number I give you by 2 and return me the new numbers, one number each line.",
    llm_config={"config_list": [{"model": "gpt-3.5-turbo", "api_key": os.environ["OPENAI_API_KEY"]}]},
    human_input_mode="NEVER",
)

adder_agent.description = "Add 1 to each input number."
multiplier_agent.description = "Multiply each input number by 2."
subtracter_agent.description = "Subtract 1 from each input number."
divider_agent.description = "Divide each input number by 2."
number_agent.description = "Return the numbers given."

from autogen import GroupChat

group_chat = GroupChat(
    agents=[adder_agent, multiplier_agent, subtracter_agent, divider_agent, number_agent],
    messages=[],
    max_round=6,
)

group_chat_with_introductions = GroupChat(
    agents=[adder_agent, multiplier_agent, subtracter_agent, divider_agent, number_agent],
    messages=[],
    max_round=6,
    send_introductions=True,
)

from autogen import GroupChatManager

group_chat_manager = GroupChatManager(
    groupchat=group_chat,
    llm_config={"config_list": [{"model": "gpt-3.5-turbo", "api_key": os.environ["OPENAI_API_KEY"]}]},
)

# Let's use the group chat with introduction messages created above.
group_chat_manager_with_intros = GroupChatManager(
    groupchat=group_chat_with_introductions,
    llm_config={"config_list": [{"model": "gpt-3.5-turbo", "api_key": os.environ["OPENAI_API_KEY"]}]},
)

allowed_transitions = {
    number_agent: [adder_agent, number_agent],
    adder_agent: [multiplier_agent, number_agent],
    subtracter_agent: [divider_agent, number_agent],
    multiplier_agent: [subtracter_agent, number_agent],
    divider_agent: [adder_agent, number_agent],
}

constrained_graph_chat = GroupChat(
    agents=[adder_agent, multiplier_agent, subtracter_agent, divider_agent, number_agent],
    allowed_or_disallowed_speaker_transitions=allowed_transitions,
    speaker_transitions_type="allowed",
    messages=[],
    max_round=12,
    send_introductions=True,
)

constrained_group_chat_manager = GroupChatManager(
    groupchat=constrained_graph_chat,
    llm_config={"config_list": [{"model": "gpt-4", "api_key": os.environ["OPENAI_API_KEY"]}]},
)

# chat_result = number_agent.initiate_chat(
#     constrained_group_chat_manager,
#     message="My number is 3, I want to turn it into 10. Once I get to 10, keep it there.",
#     summary_method="reflection_with_llm",
# )
# Start a sequence of two-agent chats between the number agent and
# the group chat manager.
# chat_result = number_agent.initiate_chats(
#     [
#         {
#             "recipient": group_chat_manager_with_intros,
#             "message": "My number is 3, I want to turn it into 13.",
#         },
#         {
#             "recipient": group_chat_manager_with_intros,
#             "message": "Turn this number to 32.",
#         },
#     ]
# )
# chat_result = number_agent.initiate_chat(
#     group_chat_manager,
#     message="My number is 3, I want to turn it into 13.",
#     summary_method="reflection_with_llm",
# )

# print("chat_result.summary", chat_result)

# Start a sequence of two-agent chats.
# Each element in the list is a dictionary that specifies the arguments
# for the initiate_chat method.
# chat_results = number_agent.initiate_chats(
#     [
#         {
#             "recipient": adder_agent,
#             "message": "14",
#             "max_turns": 2,
#             "summary_method": "last_msg",
#         },
#         {
#             "recipient": multiplier_agent,
#             "message": "These are my numbers",
#             "max_turns": 2,
#             "summary_method": "last_msg",
#         },
#         {
#             "recipient": subtracter_agent,
#             "message": "These are my numbers",
#             "max_turns": 2,
#             "summary_method": "last_msg",
#         },
#         {
#             "recipient": divider_agent,
#             "message": "These are my numbers",
#             "max_turns": 2,
#             "summary_method": "last_msg",
#         },
#     ]
# )