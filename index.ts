import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';

interface Book {
  id: string;
  title: string;
  author: string;
  price: number;
  stock: number;
  createdAt: string;
}

interface BookEdge {
  cursor: string;
  node: Book;
}

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

interface BookConnection {
  edges: BookEdge[];
  pageInfo: PageInfo;
  totalCount: number;
}

interface BooksArgs {
  first: number;
  after?: string | null;
}

interface BookArgs {
  id: string;
}

interface AddBookArgs {
  title: string;
  author: string;
  price: number;
  stock: number;
}

interface UpdateBookArgs {
  id: string;
  title?: string;
  author?: string;
  price?: number;
  stock?: number;
}

interface DeleteBookArgs {
  id: string;
}

const books: Book[] = [];
let nextId = 1;

const sampleTitles = [
  'The Pragmatic Programmer', 'Clean Code', 'Design Patterns', 'Refactoring',
  'Domain-Driven Design', 'The Mythical Man-Month', 'Code Complete', 'Working Effectively with Legacy Code',
  'Patterns of Enterprise Application Architecture', 'Test-Driven Development',
];

for (let i = 0; i < 30; i++) {
  books.push({
    id: String(nextId++),
    title: `${sampleTitles[i % sampleTitles.length]} (Vol ${Math.floor(i / 10) + 1})`,
    author: `Author ${i + 1}`,
    price: 20 + (i % 5) * 5,
    stock: 10 + i,
    createdAt: new Date(2025, 0, i + 1).toISOString(),
  });
}

const typeDefs = `#graphql
  type Book {
    id: ID!
    title: String!
    author: String!
    price: Float!
    stock: Int!
    createdAt: String!
  }

  type BookEdge {
    cursor: String!
    node: Book!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type BookConnection {
    edges: [BookEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type Query {
    books(first: Int = 10, after: String): BookConnection!
    book(id: ID!): Book
  }

  type Mutation {
    addBook(title: String!, author: String!, price: Float!, stock: Int!): Book!
    updateBook(id: ID!, title: String, author: String, price: Float, stock: Int): Book!
    deleteBook(id: ID!): Boolean!
  }
`;

// --- Cursor helpers ---
const encodeCursor = (id: string): string =>
  Buffer.from(`book:${id}`).toString('base64');

const decodeCursor = (cursor: string): string =>
  Buffer.from(cursor, 'base64').toString('utf8').replace(/^book:/, '');

// --- Resolvers ---
const resolvers = {
  Query: {
    books: (_: any, { first, after }: BooksArgs): BookConnection => {
      const safeFirst = Math.min(100, Math.max(1, first));

      let startIndex = 0;
      if (after) {
        const afterId = decodeCursor(after);
        const idx = books.findIndex(b => b.id === afterId);
        startIndex = idx === -1 ? 0 : idx + 1;
      }

      const slice = books.slice(startIndex, startIndex + safeFirst);
      const edges: BookEdge[] = slice.map(book => ({
        cursor: encodeCursor(book.id),
        node: book,
      }));

      return {
        edges,
        totalCount: books.length,
        pageInfo: {
          hasNextPage: startIndex + safeFirst < books.length,
          hasPreviousPage: startIndex > 0,
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges[edges.length - 1]?.cursor ?? null,
        },
      };
    },

    book: (_: any, { id }: BookArgs): Book | undefined =>
      books.find(b => b.id === id),
  },

  Mutation: {
    addBook: (_: any, { title, author, price, stock }: AddBookArgs): Book => {
      const book: Book = {
        id: String(nextId++),
        title,
        author,
        price,
        stock,
        createdAt: new Date().toISOString(),
      };
      books.push(book);
      return book;
    },

    updateBook: (_: any, { id, title, author, price, stock }: UpdateBookArgs): Book => {
      const book = books.find(b => b.id === id);
      if (!book) throw new Error('Book not found');
      if (title !== undefined) book.title = title;
      if (author !== undefined) book.author = author;
      if (price !== undefined) book.price = price;
      if (stock !== undefined) book.stock = stock;
      return book;
    },

    deleteBook: (_: any, { id }: DeleteBookArgs): boolean => {
      const i = books.findIndex(b => b.id === id);
      if (i === -1) return false;
      books.splice(i, 1);
      return true;
    },
  },
};

// --- Start ---
const app = express();
const server = new ApolloServer({ typeDefs, resolvers });
await server.start();

app.use('/graphql', cors(), express.json(), expressMiddleware(server));

app.listen(4000, () => {
  console.log('http://localhost:4000/graphql');
});