import axios from 'axios';
import he from 'he';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from "openai";
import xml2js from 'xml2js';


function convertSecondsToTimeString(seconds_input: number): string {
  if (isNaN(seconds_input) || seconds_input < 0) {
    throw new Error('Invalid input: must be a non-negative integer');
  }

  const hours = Math.floor(seconds_input / 3600);
  const minutes = Math.floor((seconds_input % 3600) / 60);
  const seconds = seconds_input % 60;

  const timeParts: string[] = [];

  if (hours > 0) {
    timeParts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  }
  if (minutes > 0 || hours > 0) {
    timeParts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  }
  timeParts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);

  return timeParts.join(' ');
}

async function getVideoAttributes(videoUrl: string): Promise<{ title: string; length: string; channel: string; captions: string }> {
  try {
    const response = await axios.get(videoUrl);
    const data = response.data;

    const jsonStart = data.indexOf('ytInitialPlayerResponse = ') + 'ytInitialPlayerResponse = '.length;  // This string is a marker used by YouTube to indicate the start of a JSON object containing various metadata and information about the video
    const jsonEnd = data.indexOf(';</script>', jsonStart);  // This string indicates the end of the JSON object within the HTML content
    const jsonString = data.substring(jsonStart, jsonEnd);
    const playerResponse = JSON.parse(jsonString);

    const title = playerResponse.videoDetails.title;
    const lengthInSeconds = parseInt(playerResponse.videoDetails.lengthSeconds, 10);
    const lengthString = convertSecondsToTimeString(lengthInSeconds);
    const channel = playerResponse.annotations[0].playerAnnotationsExpandedRenderer.featuredChannel.channelName;
    const captions = playerResponse.captions;
    if(!captions) throw new Error('No captions found');

    const captionTracks = captions.playerCaptionsTracklistRenderer.captionTracks;
    if(!captionTracks || !captionTracks.length) throw new Error('No caption tracks found');

  const captionBaseUrl = decodeURI(captionTracks[0].baseUrl);
  const captionsResponse = await axios.get(captionBaseUrl);

  const parser = new xml2js.Parser();
  const parsedCaptions = await parser.parseStringPromise(captionsResponse.data);

  const transcript = parsedCaptions.transcript.text;
  const captionText = transcript.map((t: any) => t._).join(' ');
  const decodedCaption = he.decode(captionText);

  return { title: title, length: lengthString, channel: channel, captions: decodedCaption };
} catch (error) {
  console.error(`Error fetching captions: ${error}`);
  throw new Error('Failed to fetch captions');
}
}

async function summarizeCapitions(captions: string): Promise<string> {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID;
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY, project: OPENAI_PROJECT_ID });

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { "role": "system", "content": "You are an assistant that summarizes video captions. Firstly, provide a one paragraph summary/overview of the captions and place a single blank line after the summary. Next, give the top 5 key points of the captions where each key point is on its own line. You MUST place a blank line between each key point. 5 points is the maximum, not a target. You do not have to provide 5 points if there are not 5 significant key points but you must provide at least one point. Describe each point with a single sentence. Place a hyphen at the beginning of each key point (do not number them) and end each sentence with a period." },
        { "role": "user", "content": captions },
      ],
      max_tokens: 1000
    }
    );

    return response.choices[0]?.message?.content?.trim() ?? '';
  } catch (error) {
    console.error('Error summarizing captions:', error);
    throw new Error('Failed to summarize captions');
  }
}

export async function POST(req: NextRequest) {
  const { videoUrl } = await req.json();

  const {title, length, channel, captions} = await getVideoAttributes(videoUrl);
  const summarizedCaptions = await summarizeCapitions(captions);

  return NextResponse.json({ title: title, length: length, channel: channel, summary: summarizedCaptions });
}
