from autogen import ConversableAgent, GroupChat
import os

from tools.searchsocial import search_social_media

# The Cruise_Influencer_Finder agent finds influencers for cruise vacations
cruise_influencer_finder = ConversableAgent(
    name="Cruise_Influencer_Finder",
    system_message="You search for and find people with large followings of Cruise Fanatics on social media.",
    llm_config={"config_list": [{"model": "gpt-3.5-turbo", "api_key": os.environ["OPENAI_API_KEY"]}]},
    human_input_mode="ALWAYS",
    tools={
        "search_social_media": search_social_media,
    },
)


