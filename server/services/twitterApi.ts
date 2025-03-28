import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';

// Initialize the Twitter API clients with different auth methods
// We'll create multiple clients to handle rate limiting better

// Check if we have the API key and secret
const hasApiKeyAndSecret = process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET;
// Check if we have a bearer token
const hasBearerToken = !!process.env.TWITTER_BEARER_TOKEN;

// Create API clients with different credentials
let appOnlyClient: TwitterApi | null = null;
let consumerClient: TwitterApi | null = null;

if (hasBearerToken) {
  // App-only authentication client
  appOnlyClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN!);
}

if (hasApiKeyAndSecret) {
  // Consumer keys authentication client
  consumerClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
  });
}

// Choose an available client
function getClient() {
  const errors: string[] = [];
  
  // Try the app-only client first (bearer token)
  if (appOnlyClient) {
    return appOnlyClient.readOnly;
  } else {
    errors.push("No Twitter Bearer Token available");
  }
  
  // Fall back to consumer client if available
  if (consumerClient) {
    return consumerClient.readOnly;
  } else {
    errors.push("No Twitter API Key/Secret available");
  }
  
  // If we get here, we don't have any valid clients
  throw new Error(`No valid Twitter API credentials: ${errors.join(', ')}`);
}

/**
 * Fetches a tweet by its ID
 * @param tweetId The ID of the tweet to fetch
 * @returns The tweet data or null if not found
 */
export async function getTweetById(tweetId: string) {
  try {
    // Get the appropriate client
    const client = getClient();
    
    // Fetch the tweet with expansions to include media
    const result = await client.v2.tweets([tweetId], {
      expansions: ['attachments.media_keys', 'author_id'],
      'media.fields': ['duration_ms', 'height', 'media_key', 'preview_image_url', 'type', 'url', 'width', 'variants'],
      'user.fields': ['name', 'username'],
    });
    
    return result;
  } catch (error) {
    // Check if it's a rate limit error
    if (error instanceof Error && error.message.includes('429')) {
      throw new Error('Twitter API rate limit exceeded. Please try again later.');
    }
    
    console.error('Error fetching tweet:', error);
    throw new Error(`Failed to fetch tweet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts the tweet ID from a Twitter URL
 * @param url The Twitter URL
 * @returns The tweet ID
 */
export function extractTweetId(url: string): string {
  const urlMatch = url.match(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/i);
  
  if (!urlMatch || !urlMatch[1]) {
    throw new Error('Invalid Twitter URL format');
  }
  
  return urlMatch[1];
}

/**
 * Extracts the video URL from a tweet
 * @param tweetData The tweet data
 * @returns The video URL if found, otherwise null
 */
export async function extractVideoUrl(tweetData: any): Promise<string | null> {
  try {
    // Check if it's an array (as returned by tweets()) or a single tweet
    const tweet = Array.isArray(tweetData.data) ? tweetData.data[0] : tweetData.data;
    
    if (!tweet?.attachments?.media_keys?.length) {
      throw new Error('No media found in tweet');
    }
    
    const mediaKey = tweet.attachments.media_keys[0];
    const media = tweetData.includes?.media?.find((m: any) => m.media_key === mediaKey);
    
    if (!media || media.type !== 'video') {
      throw new Error('No video found in tweet');
    }
    
    // Find the best quality video variant
    if (media.variants && media.variants.length) {
      // Sort variants by bit rate (descending) and take the highest quality
      const sortedVariants = [...media.variants]
        .filter((v: any) => v.content_type === 'video/mp4' && v.bit_rate)
        .sort((a: any, b: any) => b.bit_rate - a.bit_rate);
      
      if (sortedVariants.length > 0) {
        return sortedVariants[0].url;
      }
    }
    
    // Fallback to the preview image URL
    if (media.preview_image_url) {
      console.warn('No video variants found, falling back to preview image');
      return media.preview_image_url;
    }
    
    throw new Error('Could not extract video URL from tweet');
  } catch (error) {
    console.error('Error extracting video URL:', error);
    throw new Error(`Failed to extract video URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets information about a Twitter video
 * @param url The Twitter URL
 * @returns An object containing video information
 */
export async function getTwitterVideoInfo(url: string) {
  try {
    const tweetId = extractTweetId(url);
    const tweetData = await getTweetById(tweetId);
    
    if (!tweetData) {
      throw new Error('Tweet not found');
    }
    
    const videoUrl = await extractVideoUrl(tweetData);
    
    if (!videoUrl) {
      throw new Error('No video found in tweet');
    }
    
    const user = tweetData.includes?.users?.[0];
    
    // Get the tweet text from the tweet data
    const tweet = Array.isArray(tweetData.data) ? tweetData.data[0] : tweetData.data;
    
    return {
      tweetId,
      username: user?.username || 'unknown',
      authorName: user?.name || 'Unknown',
      videoUrl,
      tweetText: tweet?.text || '',
    };
  } catch (error) {
    console.error('Error getting Twitter video info:', error);
    throw new Error(`Failed to get Twitter video info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Downloads a video from a URL
 * @param url The URL of the video to download
 * @returns The video data as a Buffer
 */
export async function downloadVideo(url: string): Promise<Buffer> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
    });
    
    return Buffer.from(response.data, 'binary');
  } catch (error) {
    console.error('Error downloading video:', error);
    throw new Error(`Failed to download video: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}