# Changelog

All notable changes to Overture will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial public release
- Interactive plan canvas with pan, zoom, and search
- Node states: pending, active, completed, failed, skipped
- Branching and decision nodes for alternative approaches
- Rich context attachment (files, documents, images)
- MCP server attachment per node
- Dynamic AI-generated input fields
- Real-time execution tracking with live status updates
- Dark mode UI with smooth animations
- Support for Claude Code, Cursor, Cline, and Sixth agents
- `get_usage_instructions` tool for automatic agent documentation
- WebSocket-based real-time communication
- Plan history and persistence
- Approval workflow with field values and branch selections

### Technical
- MCP server built with TypeScript
- React + Zustand for the UI
- ReactFlow for the canvas
- Tailwind CSS for styling
- Framer Motion for animations

## [0.1.0] - 2026-02-21

### Added
- Initial release of Overture MCP server
- Full plan visualization and approval workflow
- Multi-agent support (Claude Code, Cursor, Cline, Sixth)

---

## Release Notes Format

### Added
For new features.

### Changed
For changes in existing functionality.

### Deprecated
For soon-to-be removed features.

### Removed
For now removed features.

### Fixed
For any bug fixes.

### Security
In case of vulnerabilities.
