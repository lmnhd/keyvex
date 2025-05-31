from typing import List
from bs4 import BeautifulSoup
import requests


def get_current_cruise_group_promos() -> List[str]:
    """Get top groups list from Cruise Brothers Agent tools"""
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36",
        "Cookie": 'csrftoken=MX2ey13gV4sq0KelwjpdnCpDK6CkWx1fPb061Of2tNbMfBzObj2SzUGg32PHJOZt; Path=/; Secure; Expires=Thu, 03 Apr 2025 19:23:38 GMT;sessionid=u5ggsrzg1w8jcwfa5uakq6neiwvfkk7h; Path=;'
        }

    url = "https://www.cbagenttools.com/groups/view_groups/"

    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, "html.parser")

    promos = []
     # find table element with class="booking-table" and loop through each td
    table = soup.find("table", class_="booking-table")
    if table:
        for tr in table.find_all("tr"):
           # print(tr)
            obj = {}
            i = 0
            for td in tr.find_all("td"):
                if i == 0:
                    obj["groupID"] = td.text.strip()
                    #print(obj)
                elif i == 1:
                    obj["ship"] = td.text.strip()
                    #print(obj)
                elif i == 2:
                    obj["vendor"] = td.text.strip()
                    #print(obj)
                elif i == 3:
                    obj["itinerary"] = td.text.strip()
                    #print(obj)
                elif i == 4:
                    obj["port"] = td.text.strip()
                    #print(obj)
                elif i == 5:
                    obj["nights"] = td.text.strip()
                    #print(obj)
                elif i == 6:
                    obj["saildate"] = td.text.strip()
                    #print(obj)
                elif i == 7:
                    obj["amenities"] = td.text.strip()
                    #print(obj)
                elif i == 8:
                    obj["price"] = td.text.strip()
                    #print(obj)
                elif i == 9:
                    obj["advantage"] = td.text.strip()
                    #print(obj)
                i += 1
            
            promos.append(obj)
            #print(obj)
                
       
       
    
    
    
    print(promos)
  
get_current_cruise_group_promos()