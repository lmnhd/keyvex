import requests
import matplotlib.pyplot as plt
from PIL import Image
from io import BytesIO
import os

def get_images(search_term):
    subscription_key = os.environ["BING_SEARCH_API_KEY"]
    search_url = "https://api.bing.microsoft.com/v7.0/images/search"

    headers = {"Ocp-Apim-Subscription-Key": subscription_key}
    params = {"q": search_term, "license": "public", "imageType": "photo"}

    response = requests.get(search_url, headers=headers, params=params)
    response.raise_for_status()
    search_results = response.json()
    thumbnail_urls = [img["thumbnailUrl"] for img in search_results["value"][:16]]

    # images = []
    # for url in thumbnail_urls:
    #     image_data = requests.get(url)
    #     image_data.raise_for_status()
    #     image = Image.open(BytesIO(image_data.content))
    #     images.append(image)

    return thumbnail_urls


print("Images retrieved!", get_images("Celebrity Edge"))