import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs';
import { ApolloServer } from 'apollo-server-express';
import query from './query';
import scores from '../scores';
global['fetch'] = fetch;

export const schemaFile = path.join(__dirname, './schema.gql');
export const typeDefs = fs.readFileSync(schemaFile, 'utf8');

export const resolvers = {
  Query: {
    scores
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  tracing: true,
  playground: {
    // @ts-ignore
    shareEnabled: true,
    tabs: [
      {
        endpoint: 'https://score.snapshot.org/graphql',
        query
      }
    ]
  }
});

export default server;
