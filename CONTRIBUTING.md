# Contributing to Collective Defense

We welcome contributions from the community! This document outlines the process for contributing to the project.

## Code of Conduct
Please be respectful and considerate of others when participating in this project.

## Development Workflow

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally.
3. **Create a new branch** for your feature or bugfix (`git checkout -b feature/my-new-feature`).
4. **Make your changes** and ensure they follow the project's coding standards.
5. **Test your changes** locally by running the development server (`npm run dev`).
6. **Commit your changes** with clear and descriptive commit messages.
7. **Push your branch** to your fork on GitHub.
8. **Submit a Pull Request** to the main repository.

## Coding Standards
- Use TypeScript for all new code.
- Follow the existing code style and formatting.
- Ensure all components are responsive and accessible.
- Keep the mobile interface minimalist and focused on haptic/audio feedback.

## Architecture Guidelines
- The game engine (`server.ts`) should remain the single source of truth.
- Keep the WebSocket payloads as small as possible to minimize latency.
- Do not add complex UI elements to the mobile controller (`MobileController.tsx`).

Thank you for contributing!
