import axios from 'axios';
import fs from 'fs';

const BASE_SUBGRAPH = "https://base-mainnet.subgraph.x.superfluid.dev/";
const DEGEN_TOKEN = "0x1eff3dd78f4a14abfa9fa66579bd3ce9e1b30529";

const query = `
query getAccounts($skip: Int!) {
    accounts(first: 100, where: {isSuperApp: true}, skip: $skip) {
      id
      inflows(where: {token: "0x1eff3dd78f4a14abfa9fa66579bd3ce9e1b30529"}) {
        sender {
          id
        }
      }
    }
  }
`;

async function fetchSuperApps() {
  let allAccounts = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await axios.post(BASE_SUBGRAPH, {
      query: query,
      variables: { skip: skip, token: DEGEN_TOKEN }
    });

    const accounts = response.data.data.accounts;
    allAccounts.push(...accounts);
    skip += 100;
    hasMore = accounts.length === 100;
  }
  console.log("channels: ", allAccounts.length);
  const superApps = allAccounts.filter(account => account.inflows.length > 0);
  function analyzeSubscribers(superApps) {
    const subscriberMap = {};

    superApps.forEach(app => {
      app.inflows.forEach(inflow => {
        const senderId = inflow.sender.id;
        if (subscriberMap[senderId]) {
          subscriberMap[senderId].count += 1;
          subscriberMap[senderId].streams.push(app.id);
        } else {
          subscriberMap[senderId] = { count: 1, streams: [app.id] };
        }
      });
    });

    const subscribers = Object.keys(subscriberMap).map(key => ({
      id: key,
      count: subscriberMap[key].count,
      streams: subscriberMap[key].streams
    }));

    // Sort subscribers by the number of streams in descending order
    subscribers.sort((a, b) => b.count - a.count);

    // Log the top streamers
    console.log("Top streamers by number of streams:");
    subscribers.slice(0, 10).forEach(subscriber => {
      console.log(`ID: ${subscriber.id}, Streams: ${subscriber.count}`);
    });

    return subscribers;
  }

  console.log("Top channels by number of subscribers:");
  const topChannels = superApps
    .map(app => ({
      id: app.id,
      name: app.name,
      subscriberCount: app.inflows.length
    }))
    .sort((a, b) => b.subscriberCount - a.subscriberCount)
    .slice(0, 10);

  topChannels.forEach(channel => {
    console.log(`ID: ${channel.id}, Name: ${channel.name}, Subscribers: ${channel.subscriberCount}`);
  });

  const subscribers = analyzeSubscribers(superApps);
  console.log(`# of users with >0 streams: ${subscribers.length}`);
  console.log("# of channels with >0 streams: ", superApps.length);
  fs.writeFileSync('./results/superApps.json', JSON.stringify(superApps, null, 2));
}

fetchSuperApps();
