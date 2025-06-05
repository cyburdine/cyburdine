---
title: "Startup 01: Firepype"
layout: project
tags: [webapp, startup]
---
<!--
SPDX-FileCopyrightText: © 2025 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause
-->
<div class="project">
Back in late 2012, I was spending my weekends working with a few large churches that were doing full-scale, live multi-camera video productions. We’d be up at 5 AM setting up for three back-to-back services, each an hour or more. And after that? The real grind started: taking all that footage, encoding it a dozen different ways, and pushing it out to every platform like YouTube, Vimeo, Facebook, FTP servers, internal archives, you name it.

Every destination had its own quirks. One needed MP4s at a specific resolution. Another wanted FLVs with a totally different bitrate. One required an FTP upload. Another had a web uploader that only worked in Firefox. It was exhausting. And I knew I wasn’t the only one. This was happening every Sunday at churches, media teams, and agencies all over the world. People were burning out just moving files around.

It was clearly a broken workflow. So I started asking: what if we could automate the whole thing?

That’s where Firepype was born. Cloud drives like Dropbox and Google Drive were just starting to go mainstream. Video hosting sites were getting more mature. It felt like the perfect moment to build something that could automate media distribution from start to finish. My vision was simple: drop a file into a folder, and Firepype would handle the rest. Encoding, tagging, uploading. If you knew where a file needed to go and what format it needed to be in, why not just build a pipeline that did all the heavy lifting for you?

I wanted to create the magic black box. You drop something in one side, and clean, processed media pops out the other.

So I mocked it up and pitched the idea to my brother-in-law, Michael. He jumped in and over the next year, built version one. It watched cloud storage folders, picked up new files, processed them, and pushed them to whatever destinations we had wired in.

The first time it worked, I almost couldn’t believe it. For someone who had spent years manually doing all this work, it felt like pure magic. Seeing a file land in a folder and show up on YouTube, already converted to my specs, without me doing a thing, I knew we were onto something.

Eventually, Michael moved on to other projects, and that’s when my friend Jimmy stepped in and rewrote everything from the ground up. He brought a whole new level of polish, flexibility, and power to the platform. We added more integrations, cleaner workflows, and officially launched version two in the fall of 2013.

Initially, we focused on video creators, including indie filmmakers, church media teams, and small agencies. But by early 2015, we saw something else bubbling up. Podcasting was making a comeback. And guess what? Podcasters were dealing with the exact same problems, wasting hours uploading the same episode to Apple Podcasts, Stitcher, SoundCloud, and the rest. So we pivoted.

Jimmy adapted Firepype to handle podcast-specific workflows. It could ingest MP3s, update feeds, manage metadata, and push episodes to all the major directories. Then he built something incredible: real-time download analytics. At the time, most podcast platforms gave you stats with a 24 to 48 hour delay. But with Firepype, you could open your dashboard and watch downloads roll in live, just like Google Analytics. It was insanely cool.

Then we took it a step further.

We realized that because we were already managing the publishing pipeline, we could support dynamic ad insertion. If a podcaster structured their show with ad slots like intro, content, ads, and outro, we could let them upload new ad spots anytime. The system would recompile the episodes behind the scenes with the new ad, without affecting the feed or playback.

This meant podcasters could sell campaigns that applied across their entire catalog, not just upcoming episodes. Advertisers loved that. Podcasters loved that. Listeners got fresh ads, not stale ones from three years ago. And no one had to touch an RSS feed or re-upload an episode.

Honestly, it still feels ahead of its time.

But the thing we never quite nailed was marketing.

We didn’t have investors. No ad budget. No conference booths. No podcast sponsorships. Just the three of us writing blog posts, sending tweets, and hoping people would stumble across us. We never offered a freemium plan, which in hindsight made it harder to build momentum. Our users were the ones who really needed what we built, but not always the ones who had the time or budget to experiment with a new paid tool.

By early 2016, it was clear the momentum had slowed. We were all tied up in other full-time jobs, and without the funding or focus to scale it up, we made the hard decision to sunset Firepype.

Still, I’m incredibly proud of what we built.

We solved a soul-sucking problem, manual media distribution, and gave people back their Sundays. We built real-time podcast stats before anyone else. We created a dynamic ad system that still doesn’t exist in most podcast platforms today. And we did it with zero outside funding. Just hard work, curiosity, and a lot of nights and weekends.

Firepype didn’t make it, but the lessons were priceless. Build for a real pain. Solve it simply. Stay flexible. Know when to pivot. And always remember, timing and visibility matter just as much as the tech.

I still think about Firepype whenever I see all these modern tools with their little “Share on YouTube” buttons and think, yeah, we were doing that before it was cool.
</div>
