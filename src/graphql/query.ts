export default `query {
  scores(
    space: "yam.eth"
    network: "1"
    snapshot: 12345000
    strategies: [
     {
      name: "erc20-balance-of",
        params: {
          symbol: "DAI",
          address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
          decimals: 18
        }
      }
    ]
    addresses: [
      "0xeF8305E140ac520225DAf050e2f71d5fBcC543e7",
      "0xa478c2975ab1ea89e8196811f51a7b7ade33eb11",
      "0xeF8305E140ac520225DAf050e2f71d5fBcC543e7",
      "0x1E1A51E25f2816335cA436D65e9Af7694BE232ad",
      "0x1c7a9275F2BD5a260A9c31069F77d53473b8ae2e",
      "0x1d5E65a087eBc3d03a294412E46CE5D6882969f4",
      "0x8d5F05270da470e015b67Ab5042BDbE2D2FEFB48",
      "0x1f254336E5c46639A851b9CfC165697150a6c327",
      "0x2ec3F80BeDA63Ede96BA20375032CDD3aAfb3030",
      "0x1F717Ce8ff07597ee7c408b5623dF40AaAf1787C",
      "0x8d07D225a769b7Af3A923481E1FdF49180e6A265",
      "0x38C0039247A31F3939baE65e953612125cB88268"
    ]
  ) {
    state
    scores
  }
}
`;
