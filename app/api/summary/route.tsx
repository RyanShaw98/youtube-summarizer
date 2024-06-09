import axios from 'axios';
import he from 'he';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from "openai";
import xml2js from 'xml2js';


async function getYoutubeCaptions(videoUrl: string): Promise<string> {
  try {
    const response = await axios.get(videoUrl);
    const data = response.data;

    const jsonStart = data.indexOf('ytInitialPlayerResponse = ') + 'ytInitialPlayerResponse = '.length;  // This string is a marker used by YouTube to indicate the start of a JSON object containing various metadata and information about the video
    const jsonEnd = data.indexOf(';</script>', jsonStart);  // This string indicates the end of the JSON object within the HTML content
    const jsonString = data.substring(jsonStart, jsonEnd);
    const playerResponse = JSON.parse(jsonString);

    const captions = playerResponse.captions;
    if (!captions) throw new Error('No captions found');

    const captionTracks = captions.playerCaptionsTracklistRenderer.captionTracks;
    if (!captionTracks || !captionTracks.length) throw new Error('No caption tracks found');

    const captionBaseUrl = decodeURI(captionTracks[0].baseUrl);
    const captionsResponse = await axios.get(captionBaseUrl);

    const parser = new xml2js.Parser();
    const parsedCaptions = await parser.parseStringPromise(captionsResponse.data);

    const transcript = parsedCaptions.transcript.text;
    const captionText = transcript.map((t: any) => t._).join(' ');
    const decodedCaption = he.decode(captionText);

    return decodedCaption;
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
        { "role": "system", "content": "You are an assistant that provides a concise summary of a YouTube video's captions. Try to provide takeaway points on what the video discusses rather than a general explanation of what it is about" },
        { "role": "user", "content": captions },
      ],
      max_tokens: 500
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

  const captions = await getYoutubeCaptions(videoUrl);
  const summarizedCaptions = await summarizeCapitions(captions);

  return NextResponse.json({ summary: summarizedCaptions });
}
