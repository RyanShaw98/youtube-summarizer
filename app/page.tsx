"use client";

import axios from 'axios';
import { useState } from 'react';

import TailSpin from "@/components/tail-spin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


function isYouTubeUrlValid(url: string) {
  var p = /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;
  return p.test(url);
}

export default function Home() {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post('/api/summary', { videoUrl });
      setSummary(response.data.summary);
    } catch (error) {
      console.error("Error fetching summary:", error);
      setSummary("No captions found!")
    } finally {
      setLoading(false);
    }
  };

  const isUrlValid = isYouTubeUrlValid(videoUrl);

  return (
    <div className="w-full min-h-screen bg-gray-100 dark:bg-gray-950 flex flex-col items-center justify-center px-4 md:px-6">
      <div className="max-w-3xl w-full space-y-6">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-black dark:text-white">Summarize YouTube Videos</h1>
          <p className="text-gray-500 md:text-xl dark:text-gray-400">
            Enter a YouTube video URL and we&apos;ll provide a summary in seconds.
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <form onSubmit={handleSubmit} className="flex w-full space-x-2">
              <Input type="text" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Enter YouTube video URL" />
              <Button type="submit" disabled={!isUrlValid || loading}>{loading ? <TailSpin height={32} width={32} stroke='#000000' fill='#000000' /> : "Summarize"}</Button>
            </form>
          </div>
          {summary && (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
              <p className="text-gray-500 dark:text-gray-400">{summary}</p>
            </div>)}
        </div>
      </div>
    </div>
  );
}
