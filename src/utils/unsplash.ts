// src/utils/unsplash.ts

interface UnsplashImage {
  urls: {
    regular: string;
    full: string;
  };
  alt_description: string;
  user: {
    name: string;
    links: {
      html: string;
    };
  };
}

export const fetchRandomLandscapeImage = async (
  queries: string[] = ['landscape'] // Default to 'landscape' if no specific queries are provided
): Promise<UnsplashImage | null> => {
  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    console.warn("VITE_UNSPLASH_ACCESS_KEY is not set. Cannot fetch background image from Unsplash.");
    return null;
  }

  try {
    // Randomly select one query from the provided list
    const selectedQuery = queries[Math.floor(Math.random() * queries.length)];

    const response = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(selectedQuery)}&orientation=landscape&client_id=${accessKey}`
    );

    if (!response.ok) {
      console.error(`Failed to fetch Unsplash image: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: UnsplashImage = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching random Unsplash image:", error);
    return null;
  }
};