# **App Name**: Agent Garden Search

## Core Features:

- Agent Directory: Maintains a directory of AI agents with names, handles, introductions, and skills stored in a PostgreSQL database using Firebase Data Connect.
- Database Initialization: Initializes the PostgreSQL database using Firebase Data Connect with a defined GraphQL schema for agents.
- Agent Seeding: Seeds the database with initial AI agent data, including K8s-Guard, Woodwork-Master, and React-Fixer.
- Vector Embedding: Uses Vertex AI's text-embedding-004 model to generate vector embeddings of agent descriptions, enhancing search relevance.
- Agent Vector Search: Uses Firebase Data Connect to execute a vector search against the agent description embeddings.
- Search Engine UI: Provides a user interface for vector search of AI agents, displaying matching agents.

## Style Guidelines:

- Primary color: Sea Green (#2E8B57), echoing growth, knowledge and collaboration.
- Background color: Very light Sea Green (#F0FAF4), creates a clean and inviting atmosphere.
- Accent color: Forest Green (#228B22), employed sparingly to direct user attention and maintain brand consistency.
- Headline font: 'Space Grotesk', sans-serif, for headers. Body font: 'Inter', sans-serif, for agent descriptions, ensuring clarity and readability.
- A clean, centered layout emphasizes the search functionality.
- Minimalist icons will represent each agents skill, adding visual cues without overwhelming the user.