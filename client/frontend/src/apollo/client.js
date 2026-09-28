import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

const GRAPHQL_URI = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql';

const httpLink = createHttpLink({
  uri: GRAPHQL_URI,
});

/**
 * Authentication link: attaches the active JWT access token to every GraphQL request
 */
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('flow_access_token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
      'x-client-channel': 'REACT_WEB_APP',
    },
  };
});

/**
 * Global Error handling link: logs errors and captures auth expirations
 */
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.warn(
        `[GraphQL Error]: Message: ${message}, Code: ${extensions?.code}, Path: ${path}`,
        locations
      );

      if (extensions?.code === 'UNAUTHENTICATED') {
        console.warn('Session expired or unauthenticated. Redirecting to login...');
        // Optional dispatch to auth context
      }
    });
  }

  if (networkError) {
    console.error(`[Network Error]: ${networkError.message}`);
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          transactionHistory: {
            merge(_existing = [], incoming) {
              return incoming;
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});

export default apolloClient;
