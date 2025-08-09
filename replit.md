# Overview

This is a file upload and management web application built with a modern full-stack architecture. The application allows users to upload files, manage them through a dashboard interface, and control access permissions. It features a React frontend with TypeScript, an Express.js backend, and integrates with cloud storage services for file handling.

## Recent Changes (January 9, 2025)
- Fixed multiple file upload processing - now handles all successful uploads instead of just the first one
- Added comprehensive bulk operations functionality:
  - Bulk file selection with checkboxes
  - Select All functionality  
  - Bulk delete operations
  - Bulk download capabilities
  - Visual bulk action toolbar
- Implemented real-time sync system:
  - Auto-sync toggle with 5-second refresh intervals
  - Manual "Sync Now" button
  - File status monitoring (processing, synced, failed)
  - Sync status notifications and warnings
- Implemented advanced file management system:
  - **Folder Management**: Created FolderBrowser component with hierarchical folder structure
  - **File Context Menus**: Right-click context menus with rename, move, delete, and download options
  - **Tabbed Interface**: Toggle between File List view and Folder View
  - **Breadcrumb Navigation**: Visual path navigation through folder hierarchy
  - **Advanced Operations**: File renaming, folder creation with color coding, and move operations
  - **Enhanced Database Schema**: Updated to support folder relationships and enhanced file metadata

# User Preferences

Preferred communication style: Simple, everyday language.

## AWS Deployment Configuration (January 9, 2025)
- User requested AWS EC2 + S3 deployment guidance
- Created comprehensive AWS deployment guide with step-by-step instructions
- Implemented AWS S3 storage service to replace Google Cloud Storage
- Added deployment scripts and configuration files for AWS infrastructure
- Provided both quick-start and detailed manual deployment options

# System Architecture

## Frontend Architecture
- **React + TypeScript**: Single-page application using React 18 with TypeScript for type safety
- **Routing**: Client-side routing implemented with Wouter for lightweight navigation
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Components**: Comprehensive component library using Radix UI primitives with shadcn/ui styling system
- **Styling**: Tailwind CSS for utility-first styling with CSS custom properties for theming
- **File Upload**: Uppy.js integration for robust file upload functionality with drag-and-drop, progress tracking, and AWS S3 support

## Backend Architecture
- **Express.js Server**: RESTful API server with middleware for request logging, JSON parsing, and error handling
- **Database Layer**: Drizzle ORM with PostgreSQL for type-safe database operations
- **File Storage**: Google Cloud Storage integration with custom ACL (Access Control List) system for fine-grained permissions
- **Storage Abstraction**: Pluggable storage interface with in-memory implementation for development and testing

## Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **Database Schema**: 
  - Users table for authentication
  - Files table for file metadata, upload status, and object paths
  - JSONB fields for flexible metadata storage
- **Object Storage**: Google Cloud Storage for actual file content with custom ACL policy system
- **File Management**: Separate handling of public vs private file access with configurable search paths

## Authentication and Authorization
- **File Access Control**: Custom ACL system supporting different access group types (user lists, email domains, group membership, subscriptions)
- **Permission Types**: Read and write permissions with rule-based access control
- **Public vs Private**: Distinction between publicly accessible files and permission-controlled private files

## Development and Build Tools
- **Build System**: Vite for fast development and optimized production builds
- **TypeScript**: Comprehensive type checking across frontend, backend, and shared schemas
- **Database Migrations**: Drizzle Kit for database schema management and migrations
- **Path Aliases**: Clean import paths using TypeScript path mapping (@/, @shared/)

# External Dependencies

## Core Framework Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL serverless database connection
- **@google-cloud/storage**: Google Cloud Storage SDK for file storage operations
- **@tanstack/react-query**: Server state management and data fetching
- **drizzle-orm**: Type-safe database ORM with PostgreSQL dialect

## UI and Component Libraries
- **@radix-ui/***: Comprehensive set of accessible UI primitives (dialogs, dropdowns, forms, navigation, etc.)
- **@uppy/***: File upload library with AWS S3, dashboard, drag-drop, and progress components
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library for consistent iconography

## Development and Build Tools
- **vite**: Fast build tool and development server
- **@vitejs/plugin-react**: React support for Vite
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Replit-specific development tooling
- **tsx**: TypeScript execution for development server
- **esbuild**: Fast JavaScript bundler for production builds

## Form and Validation
- **react-hook-form**: Form state management and validation
- **@hookform/resolvers**: Form validation resolvers
- **zod**: Schema validation library
- **drizzle-zod**: Integration between Drizzle ORM and Zod validation

## Routing and Navigation  
- **wouter**: Minimalist client-side routing library for React

## Authentication Integration
- **Replit Sidecar**: Integration with Replit's authentication and credential services for Google Cloud Storage access