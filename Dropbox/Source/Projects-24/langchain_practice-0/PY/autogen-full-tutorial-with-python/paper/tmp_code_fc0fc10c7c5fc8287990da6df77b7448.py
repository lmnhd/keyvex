import requests
from bs4 import BeautifulSoup

def get_cruise_info():
    url = "https://www.royalcaribbean.com/cruises/?shipCode=NV"
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')

    # Find the specific cruise
    cruises = soup.find_all('div', class_='cruise')
    for cruise in cruises:
        if 'Navigator of the Seas' in cruise.text and 'Dec. 16, 2024' in cruise.text:
            destination = cruise.find('div', class_='destination').text
            duration = cruise.find('div', class_='duration').text
            features = cruise.find('div', class_='features').text
            return destination, duration, features

destination, duration, features = get_cruise_info()
print(f"Destination: {destination}")
print(f"Duration: {duration}")
print(f"Features: {features}")