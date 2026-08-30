FROM node:20-alpine

WORKDIR /app

# In development, we don't copy the whole codebase here since we use volume mounting.
# We just need to define the command to run.
CMD ["npm", "run", "dev"]
