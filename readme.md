# Nexus

Nexus is a large-scale, full-featured Discord bot platform built with TypeScript, featuring 50+ modules, 600+ commands, multi-platform dashboards, and an integrated AI chatbot module. Designed to rival and exceed the feature sets of industry-leading bots like Dyno and MEE6.

## Features

### Core Bot
- 50+ modules and 600+ commands covering moderation, automation, utility, entertainment, and more
- Fully modular architecture allowing independent development and configuration of each module
- Per-command configuration — control who can use commands, where they can be used, and how they behave

### AI Chatbot Module
- One of 50+ modules — integrated AI chatbot powered by Groq API by default, with support for user-provided API keys
- User API keys are securely stored and scoped per-user — keys are never shared across the server or used for other users' requests
- Allows server members to bring their own API key for personalized AI interactions without impacting other users

### Multi-Platform Dashboard
- **iOS App** — full configuration and management from mobile
- **Website** — browser-based dashboard for server administrators
- **Planned:** Windows, macOS, and Android apps
- Dashboard features include per-command configuration, complete logging of server events and command usage, and granular permission controls

### Architecture
- 1,000+ files and 200,000+ lines of code
- Shared utilities and gateway architecture designed for scalability

## Tech Stack
TypeScript | Swift | JavaScript | HTML | Node.js

## My Role
Sole architect and primary developer. Designed the full modular folder structure, built the gateway bot and shared utilities, integrated the AI chatbot module with secure per-user API key management, and developed the companion iOS and web dashboards. QA collaboration with Vivien Villalobos.

## Status
Active development — not yet publicly deployed.
