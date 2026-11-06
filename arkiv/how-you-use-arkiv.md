# How you use Arkiv

## Do the filters, the editor, and the expiry fit the product?

The directory looks up one demo offering, so the query filters on the two fields that name it: `projectTag` (`rwacomply`) and `offeringId` (`sepolia-demo-rwa`). The other indexed fields are there so the page can compare the result with the deployed market: `rwaSymbol`, `usdcAddress`, `rwaAddress`, `poolId`, and `expiresAt`.

The only wallet that writes the entity is the publisher, `0xbfBf7Ca4f33993fA8b918d38286dad927231FB72`. An investor cannot edit it from `/invest`. The publish script reads the query first. If this current entity is already there, it prints the same key and does not create another.

The lifetime is 90 days, set with `ExpirationTime.fromDays(90)`. The indexed `expiresAt` is unix `1801744500` (`2027-02-04`). Rabdi records the same lifetime as `$expiresAt` block `4179369`. That covers the demo window and is the date the directory treats as the end of the record.

## Does each Arkiv feature change something users see?

The query result is the Public offering panel on `/invest`. The live row is entity `0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578`. A ready record shows the RWA symbol, the offering id, the owner, that entity key, and the expiry date. The cap and period beside it are labeled as chain values.

If the query returns nothing, the panel says the record is missing. If `expiresAt` is in the past, it says expired. If the USDC address, RWA address, or pool id does not match the deployment, it says the record does not match. If Rabdi cannot be reached, or the server is started with `ARKIV_CLIENT_STOPPED=1`, it says the directory is unavailable. In each of those cases the chain cap and period remain, and the purchase button still uses the contract.

Creating the entity is what put that panel into the ready state. Reading it is what keeps the panel on the live row instead of a fixture.
