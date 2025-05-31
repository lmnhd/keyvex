import { createApi } from 'unsplash-js';
import fetch from 'node-fetch';

// Unsplash API client setup
// Using server-side only to protect the access key
export const unsplashApi = createApi({
  accessKey: process.env.UNSPLASH_ACCESS_KEY || '',
  fetch: fetch as unknown as typeof globalThis.fetch,
});

// Unsplash API integration
export const unsplashConfig = {
  accessKey: process.env.UNSPLASH_ACCESS_KEY || '',
  apiUrl: 'https://api.unsplash.com',
};

// Wrapper function to search for photos
export async function searchPhotos(query: string, page = 1, perPage = 20) {
  try {
    const result = await unsplashApi.search.getPhotos({
      query,
      page,
      perPage,
    });

    if (result.errors) {
      console.error('Error searching Unsplash:', result.errors[0]);
      return { photos: [], total: 0, error: result.errors[0] };
    }

    return {
      photos: result.response.results,
      total: result.response.total,
      error: null,
    };
  } catch (error) {
    console.error('Error searching Unsplash:', error);
    return {
      photos: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Wrapper function to get a random photo
export async function getRandomPhoto(query?: string) {
  try {
    const result = await unsplashApi.photos.getRandom({
      query,
      count: 1,
    });

    if (result.errors) {
      console.error('Error getting random photo:', result.errors[0]);
      return { photo: null, error: result.errors[0] };
    }

    return {
      photo: Array.isArray(result.response) 
        ? result.response[0] 
        : result.response,
      error: null,
    };
  } catch (error) {
    console.error('Error getting random photo:', error);
    return {
      photo: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Track download when a photo is used
export async function trackPhotoDownload(downloadLocation: string) {
  try {
    await unsplashApi.photos.trackDownload({
      downloadLocation,
    });
    return { success: true, error: null };
  } catch (error) {
    console.error('Error tracking download:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function searchUnsplashPhotos(query: string, count: number = 1) {
  const response = await fetch(
    `${unsplashConfig.apiUrl}/search/photos?query=${encodeURIComponent(query)}&per_page=${count}`,
    {
      headers: {
        'Authorization': `Client-ID ${unsplashConfig.accessKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Unsplash photos: ${response.statusText}`);
  }

  const data = await response.json();
  return data.results;
}

export async function getRandomUnsplashPhoto(query: string) {
  const response = await fetch(
    `${unsplashConfig.apiUrl}/photos/random?query=${encodeURIComponent(query)}`,
    {
      headers: {
        'Authorization': `Client-ID ${unsplashConfig.accessKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch random Unsplash photo: ${response.statusText}`);
  }

  return await response.json();
}

export interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description: string;
  user: {
    name: string;
    username: string;
    links: {
      html: string;
    };
  };
  links: {
    download_location: string;
  };
}

// Trigger download tracking when photo is used
export async function trackUnsplashDownload(downloadLocation: string) {
  await fetch(downloadLocation, {
    headers: {
      'Authorization': `Client-ID ${unsplashConfig.accessKey}`,
    },
  });
} 