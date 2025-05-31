# Unsplash Integration

This integration allows you to search and use Unsplash images in your TenantArmor application.

## Setup

1. Register as a developer at Unsplash: https://unsplash.com/developers
2. Create a new application in your Unsplash developer dashboard
3. Get your Access Key from the application details page
4. Add the Access Key to your `.env.local` file:

```
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
```

## Usage

### Using the UnsplashImagePicker Component

Import and use the component:

```tsx
import { UnsplashImagePicker } from "@/components/ui/unsplash-image-picker";

function YourComponent() {
  const handleSelectPhoto = (photo) => {
    console.log("Selected photo:", photo);
    // Use the photo object as needed
    // Make sure to include attribution as required by Unsplash
  };

  return (
    <UnsplashImagePicker 
      onSelect={handleSelectPhoto}
      buttonLabel="Select an image" // Optional, defaults to "Search Unsplash Images"
    />
  );
}
```

### Photo Attribution

According to Unsplash API guidelines, you must:

1. Credit the photographer by name with a link to their Unsplash profile
2. Indicate the photo was sourced from Unsplash
3. When a photo is downloaded, you must trigger the download tracking endpoint

Example attribution:

```tsx
<div>
  Photo by{" "}
  <a href={photo.user.links.html} target="_blank" rel="noopener noreferrer">
    {photo.user.name}
  </a>{" "}
  on{" "}
  <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">
    Unsplash
  </a>
</div>
```

## API Routes

The following API routes are available:

- `/api/unsplash?action=search&query=YOUR_QUERY&page=1&perPage=20`
- `/api/unsplash?action=random&query=OPTIONAL_QUERY`
- `/api/unsplash?action=trackDownload&downloadLocation=DOWNLOAD_LOCATION_URL`

## Troubleshooting

- If you're getting 401 errors, check that your Access Key is correct and properly set in the .env.local file
- Make sure your application's permission scope includes "Public" access
- For rate limit issues, check the Unsplash API documentation for current limits 