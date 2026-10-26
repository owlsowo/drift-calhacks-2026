# Design workflow

## Figma

We used [Figma Make](https://www.figma.com/make/4Sk3BHNmaGuxH17B36jAxP/Drift-Bottle-Interaction-Prototype) to explore the empty sea, writing and returned-story screens. The prototype helped us choose compact paper feedback, a clear daily prompt and visible six-word progress. We implemented those choices in React.

The [Figma Slides deck](https://www.figma.com/slides/aIXkdSqeFH9r8mXu7qI6zv/Drift-idea-to-working-tide) includes the prototype and design process. The [stage log](figma-stage-log.md) records tools, time and handoff decisions.

## Mana

We used Mana to build [Bottle Kitchen](https://www.mana.space/home/uZUAnp4vMmhOcc7s846yMqttA8V2/apps/drift-bottle-kitchen), a separate tool for preparing starter lines. A teammate can enter a six-word beginning, review it, check duplicates and export a file for Drift. It does not generate the stories or write directly to the live game.

The integration in `packages/starter-content` validates exported files before installation. Draft exports cannot be installed as production content. The [public build snapshot](https://www.mana.space/shared-chats/uZUAnp4vMmhOcc7s846yMqttA8V2/001792875075719b18054a2b85b4dcba093) shows the app's creation.

[Watch the demo](https://www.youtube.com/watch?v=qyhyhsEbNc4).
