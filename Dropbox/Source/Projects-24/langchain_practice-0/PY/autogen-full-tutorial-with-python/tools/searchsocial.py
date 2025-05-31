from typing import List
from bs4 import BeautifulSoup
import requests


def search_social_media(platform: str, keyword: str) -> List[str]:
    """
    Searches a social media platform for influencers.

    :param platform: The social media platform to search.
    :param keyword: The keyword to search for.
    :return: A list of influencer usernames.
    """
    # Define the search URL for the social media platform
    if platform == "twitter":
        url = f"https://twitter.com/search?q={keyword}%20-filter:retweets"
    elif platform == "instagram":
        url = f"https://www.instagram.com/explore/tags/{keyword}/"
    else:
        raise ValueError("Invalid social media platform")

    # Use the requests library to make a GET request to the search URL
    response = requests.get(url)

    # Parse the HTML content of the response
    soup = BeautifulSoup(response.content, "html.parser")

    # Extract the usernames of the top influencers
    usernames = []
    for div in soup.find_all("div", class_="MQZWZd"):
        a = div.find("a")
        if a:
            username = a["href"].strip("/")
            usernames.append(username)

    # Return the list of influencer usernames
    return usernames
