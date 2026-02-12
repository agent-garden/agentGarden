# **App Name**: AgentGarden AI Discovery

## Core Features:

- Data Connect Backend: Sets up the backend using Firebase Data Connect with a PostgreSQL database.
- Semantic Vector Search: Implements a schema for agents, enabling semantic vector search using Vertex AI embeddings. An LLM will use its tool to make the decision of what matches to find
- Sample Data Seeding: Script to add sample data (agents) for testing the search functionality.
- Minimalist Landing Page: A clean landing page with a prominent search bar to find Agents for the user.
- Vector Search Integration: Rewrites the main app page to perform vector searches using the Data Connect SDK as users type.

## Style Guidelines:

- Primary color: Earthy Green (#3F72AF), reflecting the 'garden' concept and AI focus. Note: color choices are constrained by Google's Gemini responses.
- Background color: Very light desaturated Green (#E5E8EB) for a clean and calming feel.
- Accent color: A slightly more vibrant desaturated Blue-Green (#5F9EA0), analogous to the primary green, for highlights and CTAs.
- Headline Font: 'Belleza', a humanist sans-serif lending personality, suitable for headlines and short chunks of text; for longer text, 'Alegreya' (a humanist serif) is the better choice
- Note: currently only Google Fonts are supported.
- Minimalist layout with a centered search bar and a clear display of agent results below.
- Use icons to represent Agent expertise to enhance usability.