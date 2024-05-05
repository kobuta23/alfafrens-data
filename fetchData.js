import axios from 'axios';
import fs from 'fs';

const BASE_SUBGRAPH = "https://base-mainnet.subgraph.x.superfluid.dev/";
const DEGEN_TOKEN = "0x1eff3dd78f4a14abfa9fa66579bd3ce9e1b30529";

const streamQuery = `
query MyQuery($skip: Int!) {
    streams(
      first: 100,
      skip: $skip,
      where: {currentFlowRate_gt: "0", receiver_: {isSuperApp: true}, token: "0x1eff3dd78f4a14abfa9fa66579bd3ce9e1b30529"}
    ) {
      sender {
        id
      }
      receiver {
        id
      }
      currentFlowRate
    }
  }`;

const poolQuery = `
query MyQuery($skip: Int!) {
  poolMembers(
    first: 100
    skip: $skip
    where: {pool_: {token: "0x1eff3dd78f4a14abfa9fa66579bd3ce9e1b30529", flowRate_gt: "0"}}
  ) {
    units
    createdAtBlockNumber
    isConnected
    account {
      id
    }
    pool {
      admin {
        id
        isSuperApp
        createdAtBlockNumber
      }
      flowRate
      totalUnits
      totalMembers
    }
  }
}
`


const fetchStreams = async function() {
    let allStreams = [];
    let allPools = [];
    let hasMore = true;
    let skip = 0;

    while (hasMore) {
      const response = await axios.post(BASE_SUBGRAPH, {
        query: streamQuery,
        variables: { skip: skip }
      });

      const streams = response.data.data.streams;
      allStreams.push(...streams);
      skip += 100;
      hasMore = streams.length === 100;
    }

    hasMore = true;
    skip = 0;
    while (hasMore) {
      const response = await axios.post(BASE_SUBGRAPH, {
        query: poolQuery,
        variables: { skip: skip }
      });

      const poolMembers = response.data.data.poolMembers;
      const pm = poolMembers.filter(conn => conn.pool.admin.isSuperApp).map(conn => {
        conn.channelOwner = conn.pool.admin.createdAtBlockNumber == conn.createdAtBlockNumber;
        return conn;
      });
      allPools.push(...pm);
      skip += 100;
      hasMore = pm.length === 100;
    }

    allPools.sort((a, b) => {
        if (a.channelOwner === b.channelOwner) {
            return a.pool.admin.id.localeCompare(b.pool.admin.id);
        }
        return a.channelOwner ? -1 : 1;
    });

    const data = {
        lastUpdatedTimestamp: Date.now(),
        streams: allStreams,
        poolMembers: allPools
    }

    fs.writeFileSync('./results/allStreams.json', JSON.stringify(data, null, 2));
    console.log('All streams data has been written to allStreams.json');
}



export default fetchStreams;
