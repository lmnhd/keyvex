import asyncio
import aiohttp
import os


async def generate_image():
    key = os.environ.get("GOAPI_KEY")

    endpoint = "https://api.midjourneyapi.xyz/mj/v2/imagine"

    headers = {"X-API-KEY": key}

    data = {
        "prompt": "a cute cat",
        "aspect_ratio": "4:3",
        "process_mode": "fast",
        "webhook_endpoint": "",
        "webhook_secret": "",
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(endpoint, headers=headers, json=data) as response:
            response_json = await response.json()
            task_id = response_json["task_id"]
            print('response_json', response_json)
            print('task_id', task_id)
            
            if response.status != 200:
                print(f"Error: {response.status}")
                return
            # pause for 5 seconds
            await asyncio.sleep(5)

            fetch_point = "https://api.midjourneyapi.xyz/mj/v2/fetch"
            data = {"task_id": task_id}

            async with session.post(fetch_point, json=data) as fetch_response:
                fetch_response_json = await fetch_response.json()
                print(fetch_response.status)
                print(fetch_response_json)


asyncio.run(generate_image())
