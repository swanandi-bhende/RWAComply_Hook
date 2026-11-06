# Demo script

Spoken, 2 to 4 minutes, at least 720p. A person speaks. Do not use a text-to-speech or AI voiceover, do not speed the video up, and do not replace the narration with music and captions. ETHGlobal rejects a video under 2 minutes, over 4 minutes, or under 720p.

The purchase numbers below are the local Anvil journey in `script/demo_allocation_journey.sh`. A live World ID enrollment on Ethereum Sepolia has not been completed, so the enroll and session beats cannot be filmed until a real proof is available. Do not pretend a fixture is that proof.

| Time | Say and show |
|---|---|
| 0:00–0:20 | One human, several wallets, one USDC purchase budget. Proof of human is not KYC. |
| 0:20–0:50 | Enroll Wallet A on `/invest`. The widget is a real World ID proof. The page does not show the allocation id. |
| 0:50–1:20 | Buy 700 USDC through the purchase button. Show the shared remaining budget fall to 300 USDC. |
| 1:20–1:50 | Disconnect. Connect Wallet B. Continue the same session. Do not start a new enrollment. |
| 1:50–2:15 | Request 500 USDC. The hook rejects it. The spent amount stays 700. |
| 2:15–2:40 | Buy 200 USDC. Show 100 USDC left on the shared budget. |
| 2:40–3:10 | Connect Bob, a different person. Show his own 1,000 USDC budget, untouched by Alice. |

Until the live proof exists, film the Anvil half with `bash script/demo_allocation_journey.sh` and the `/demo` balances: Alice's wallets share the remainder, Bob's budget stays separate. Say on camera that this half is local Anvil, not Sepolia, and that the World ID widget has not been completed live.
