import requests
from bs4 import BeautifulSoup


def get_google_search_results(query, num_results=10):
    url = f"https://www.google.com/search?q={query}"

    response = requests.get(url)
    soup = BeautifulSoup(response.text, "html.parser")
    #print('prettify ',soup.prettify())
    #print(soup.find( 'id="search"'))
    print(soup.find_all('a'))

    links = []
    for i, result in enumerate(soup.select("#res")):
        print('result', result)
        if i == num_results:
            break

        link = result["href"]
        if link.startswith("/url?q="):
            link = link[7:]
            links.append(link)

    return links

print(get_google_search_results("Celebrity Infinity Jan. 2, 2025"))