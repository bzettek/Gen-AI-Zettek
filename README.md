# FlowTV

FlowTV is a voice-controlled TV system for people in senior living. The resident says what they want to watch, and it plays, whether it is on a streaming service or cable. There are no menus and no remote.

**Who it is for:** Residents in assisted living and nursing homes, and older adults at home with in-home care, who struggle with modern TV menus, logins, and switching between cable and streaming apps. The buyer would be the facility, because staff currently spend time fixing residents' TVs instead of providing care.

**Quick links**
- Live prototype: https://bzettek.github.io/Gen-AI-Zettek/
- Demo video: see [Demo Video](#demo-video)
- Revision documentation: [What I changed](#what-i-changed-this-round), [Peer feedback](#peer-feedback-and-how-i-used-it), [Tests](#testing-the-revised-prototype), [Risk](#risk-a-wrong-result-and-loss-of-control)
- AI use: [Draft AI-use disclosure](#draft-ai-use-disclosure)

## How to open and test it

Open the live link in Chrome, tap the mic, and allow microphone access. A user can also type a request or click one of the "Try one" examples. "Back to home screen" resets everything.

If the live link is down, download the repository (Code, then Download ZIP) and open index.html in Chrome.

The flow follows a resident I am calling Margaret in Room 214. She asks for something, FlowTV works out what she means and where it is, and the TV shows it playing. The "Under the hood" panel on the right shows each step and the output the AI would send back.

## Where AI fits

**The task AI performs:** It turns a vague, spoken request into the exact thing to play.

- **Input:** What Margaret said (text from speech recognition), the room's catalog (what is on each service she is signed into, local cable channels, and a scene index), and context (what is playing now, or which choices are on the screen).
- **Output:** A structured result that says what she wants (play a title, watch live TV, jump to a scene, resume, or reject the last result), which title, where it is, where to start, and whether to ask her a question first.
- **Value:** She does not need to know the title, which app it is on, or how to use a menu. "The ship movie with DiCaprio" is enough. This matters because the people I am designing for are the ones who can no longer keep up with TV interfaces.

**How the AI behavior is produced right now:** This is a Wizard-of-Oz prototype. `resolve()` in app.js scores the request against keywords in catalog.js, such as titles, actors, and plot words. If two or three titles score about the same, it asks which one she meant. If only one title matches weakly, it asks her to confirm before playing. Scene jumps come from a scene index I wrote by hand. The "Under the hood" steps and JSON output are prewritten to show what a real AI agent would return.

| Part | Status |
| --- | --- |
| Speech to text | **Working.** It uses Chrome's built-in speech recognition. |
| Understanding the request | **Simulated.** Keyword scoring over 11 sample titles and channels in catalog.js. |
| Knowing a title exists but is not on her services | **Simulated.** A hand-made list of 9 well-known shows, such as Bonanza, M\*A\*S\*H, and Murder, She Wrote. |
| Asking "Which one did you mean?" and "Did you mean ___?" | **Working as rules** in app.js, not as a model. |
| "Not that one" undo | **Working** in the prototype flow. |
| Scene search | **Simulated.** Timestamps are written into catalog.js. |
| Playback, deep links, and switching to cable | **Simulated.** The TV screen is a mockup, and nothing actually streams. Services, channels, and timestamps are sample data. |
| Staff alerts | **Simulated.** Nothing is sent, and the screen now says so. |
| Live language model | **Planned** (see below). |

**Implementation blocker:** I looked at replacing `resolve()` with a real Claude API call. The problem is that the prototype is a static site in a public repository, so there is no safe place to put an API key. It needs a small server, such as Replit with Secrets, between the page and the model. I moved that to the final project so I could finish the feedback fixes first. My plan is to send the request, the room catalog, and the context to the model and only let it choose from catalog IDs. This means it cannot invent a title or a timestamp.

## What I changed this round

1. **I fixed answers to "Which one did you mean?"** Before, saying "the shark one" or "the pirate one" always played Titanic, because the word "one" was read as "number one." Now description words win, and numbers only count when they clearly mean a position, such as "number 2" or "the first one."
2. **I improved how it handles requests it cannot play.** Before, "Put on Bonanza" got the same generic "not sure" screen as "Turn the heat up." Now it says, "I heard Bonanza. It isn't on Room 214's services right now," and offers a couple of shows she does have. On any miss, it repeats back what it heard so she knows it understood her words. The suggestions can also be tapped now.
3. **I gave the resident control back, which is my risk response.** Every result now has a "Not that one?" button, and she can also say "not that one." This stops playback and offers the other close matches. If a match is weak, it asks "Did you mean Jaws?" instead of playing on its own. I also removed the made-up confidence number, which showed 0.95 even when the result was wrong, and the staff alert now clearly says it is a demo and nothing was sent. When AI recommended adding a live API came up, I chose not to implement it right away. I wanted to make sure the flow and the way residents would use it were right before adding a real model, so the AI stays simulated this round.

## Peer feedback and how I used it

| Feedback or observed issue | Decision | What changed, or why it was deferred |
| --- | --- | --- |
| Answering the follow-up question with "the shark one" or "the pirate one" played Titanic. The reviewer thought "one" was being read as "number 1" and pointed out that this is how most people would answer. | Acted on | I fixed it. Description words now win over numbers, so "the shark one" plays Jaws and "the pirate one" plays Pirates of the Caribbean. "The first one" still picks the first option. |
| When it played the wrong movie, it still showed 0.95 confidence, so it looked certain while being wrong. | Acted on | I removed the confidence number. The output now says how it matched, such as "strong match," "weak," or "picked from options by description." Weak matches ask before playing, and every result has "Not that one." |
| Normal requests outside the small catalog fail, and users could lose trust quickly. | Adapted | I cannot make the catalog large without a real AI and real service data, so I focused on making the failure helpful. It now names the title it heard, explains that it is not on her services, and suggests things she has. Full coverage is deferred to the live model. |
| The staff notification should say it is simulated so a resident does not wait for help that is not coming. | Acted on | The alert now says, "Demo only: no real alert was sent. In the real product, staff would see Room 214 needs a hand." The "add this show" message works the same way. |

## Testing the revised prototype

I tested in Chrome by typing each request. These tests evaluate the experience and whether the example outputs are useful and understandable. They do not establish model accuracy, because the AI is simulated.

| Case | Input or action | Expected result / success criterion | Actual result | Pass, partial, or fail | Implication or next step |
| --- | --- | --- | --- | --- | --- |
| Typical 1 | "Put on the movie where the ship sinks with Leonardo DiCaprio" | Titanic plays without a follow-up question, the screen shows the service, and there is a way to undo. | Titanic played on Prime Video from 0:00:00, "Not that one?" appeared in the corner, and the output said "strong match." | Pass | This works because the request uses words in my catalog. A real model needs to handle descriptions I did not write down. |
| Typical 2 | "Put on the Cubs game" | It switches to cable on its own, and she does not have to change inputs. | The Cubs game came up on local cable Ch. 32 with "Switched from streaming to cable in 1.1 s," and undo was available. | Pass | The 1.1 seconds is a target, not a measurement. Real cable control is untested. |
| Challenge | "Put on that boat movie," then "the shark one" (I also tried "the pirate one" and "the first one") | It asks which one she meant and then plays the one she described. | It asked between Titanic, Jaws, and Pirates. "The shark one" played Jaws, "the pirate one" played Pirates, and "the first one" played Titanic. | Pass | The peer review bug is fixed. It still only works for words I listed, such as "shark" and "pirate." |
| Invalid or empty | Pressed Ask with nothing entered, then "Put on Bonanza," then "Turn the heat up" twice | It never dead-ends, and it tells her what it heard and what she can do next. | Empty input showed "I didn't catch that. Try again." Bonanza showed "It isn't on Room 214's services" with two suggestions. The heat request repeated what it heard and offered tappable examples, and the second miss showed the demo-only staff message. | Partial | Bonanza only works because it is on my list of 9 shows. Any other show still gets the generic screen. This is the biggest gap a live model would close. |
| Risk | "Put on the beach movie" (a weak match), then "No." In a second run: "Put on that boat movie," "the pirate one," "Not that one," and "number 2." | A weak guess should not start playing on its own, and she should always be able to back out of a wrong result. | It asked "Did you mean Jaws?" with Yes and No buttons and did not play anything. "No" stopped it and asked her to say it another way. In the second run, "Not that one" stopped Pirates, offered Titanic and Jaws, and "number 2" played Jaws. | Pass | Undo works whether she says it or taps it. I have not tested whether real residents notice the button or remember the phrase. |

**Before and after with the same inputs:**

| Input | Before (first working slice) | After (this version) | Did the revision help? |
| --- | --- | --- | --- |
| "Put on that boat movie," then "the shark one" | Played Titanic (wrong) with 0.95 confidence | Plays Jaws, with the match listed as "picked from options by description" | Yes. This was the main bug. |
| Same, then "the pirate one" | Played Titanic | Plays Pirates of the Caribbean | Yes |
| "Put on Bonanza" | Generic "Not sure what to play" screen | "I heard Bonanza. It isn't on Room 214's services right now," with suggestions | Yes, but only for the 9 listed shows |
| "Turn the heat up" twice | "I've let the staff know you might need a hand," which sounded real | "Demo only: no real alert was sent..." | Yes. It no longer promises help that is not coming. |

### What the evidence tells me

The main flow now works well for the requests I designed it around: describing a movie, asking for live TV, jumping to a scene, and answering the follow-up question the way a person naturally would. The before-and-after results show that the peer feedback fix worked. What remains unreliable is anything outside my catalog and keyword lists. Bonanza works because I added it by hand, but a show I did not think of still falls back to the generic screen, and all of the "understanding" is keyword scoring rather than AI. These results support the value I am claiming for the experience itself, because the flow is understandable and the example outputs are useful. They do not prove that a real model would be accurate, and I have not yet tested it with an actual resident. Next, I would connect the live model through a small server, run the same five cases three times each to see whether the answers change, and have one or two older users, like my grandpa, try it by voice.

## Risk: a wrong result and loss of control

The people affected are residents, especially those with memory or hearing issues, and the staff who help them. The risk is over-reliance on AI. If FlowTV guesses wrong and confidently plays the wrong thing, a resident might not know how to get out of it, might think they asked the wrong way, or might give up and wait for staff. The earlier version made this worse because it showed 0.95 confidence on a wrong answer and said staff were notified when nothing was sent. In this version, weak matches ask "Did you mean ___?" before playing, every result has a large "Not that one?" button that also works by voice, and saying it stops playback and offers the other close matches. I also removed the fake confidence number, and the staff messages now say they are demo only. The risk test shows that she can back out of a wrong result in one step. The risk that remains is that these safeguards are rules I wrote, not a real model, so I do not know how often a live model would be confidently wrong. The button also only helps if residents notice it or remember the phrase, and the staff alert is still simulated, so a real version would need staff to confirm that they saw the alert.

## Known limitations

1. The "AI" is keyword matching over 11 titles plus a list of 9 known shows. My next step is a live model limited to the room's catalog.
2. Playback is a mockup. No real streaming service, deep link, or cable box is controlled, so the 0.7-second and 1.1-second times are targets.
3. Tap-to-talk stands in for the always-on mic. A real version needs a wake word and a privacy plan, because it would be a microphone in someone's room.
4. Staff alerts and "add this show" requests are simulated and are not sent anywhere.

## Demo Video

Google Drive link: **[https://drive.google.com/file/d/1yLRzj7N6Rd7bnWvAko1YiDddCpn4woBS/view?usp=sharing]**

The video is shared with view access for Emelia Hughes and Samuel Huang.

## Draft AI-use disclosure

I used Claude (Anthropic) throughout this project. Claude wrote most of the code (index.html, style.css, app.js, and catalog.js), ran the browser tests listed above, and helped with this README. It also helped me find the statistics for my one-pager and built the concept video and one-pager graphics.

My own judgment drove the product decisions. The idea and the target user came from me, along with keeping every streaming service signed in on the cloud so switching is fast, using deep links to open content instantly, using an always-on mic instead of a remote, and the FlowTV name. I also decided which peer feedback to act on and what to defer to the final project. I reviewed each result against the experience I wanted and asked for changes when it did not match.

## Files

- index.html: page layout (TV screen, ask bar, and Under the hood panel)
- style.css: styling
- app.js: speech input, the simulated `resolve()` step, follow-up questions, "Not that one," and what appears on the TV
- catalog.js: sample titles, channels, scenes, keywords, and the list of known shows not on her services

There are no API keys, passwords, or other secrets in this repository.
