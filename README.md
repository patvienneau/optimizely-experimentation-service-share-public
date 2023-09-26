# Technical Summary

## Optimizely Integration
We interface with Optimizely's JS SDK through a FE service built for our application, in order to provide compatibility with other experimentation tools that are used internally for other uses. This also allows us to provide to our own developers are much more succinct and condensed interface to initiate and trigger experimentation tests, as we want to standardize how we transfer data with the Optimizely service.

## Technical Assumptions/Decisions
- Optimizely `userId` is defined as a UUID stored on the browser's local storage.
  - We **wanted** to be able to cover non-authorized flows with A/B testing, so business-defined IDs could not be used
  - We **accept** that a given visitor would be considered as multiple users in the eyes of Optimizely should they use multiple devices/browsers (mobile-switch-to-desktop, for example)
  - We **accept** that local storage is not permanent persistence, and therefore a given user/browser combination may be considered as multiple users in the eyes of Optimizely, should their local storage be cleared.
  - We **assume** that these are low-frequency occurrence scenarios, and would therefore have low impact to downstream reporting.
  - We **assume** that impact would not discriminate in a measurable way in reporting between buckets.
- Optimizely manages test traffic exclusion
  - We **assume** that excluded users will not count towards test visitors based on fallback assignment (such as control (`off`) bucket if users are excluded from test).

## Invocation
We interact with Optimizely directly through our own service on a per-need basis, in order to mould the user experience to the result of the feature flag.  We currently invoke Optimizely through JS invocations, though we’ve also implemented a React hook to adapt the JS invocation interface to be invoked in JSX.

## Optimizely Configuration and Setup
We’ve tried to align our implementation with Optimizely’s suggested practices in order to get the most out of the platform. However, the implemented modules may also be source of issues that are affecting the reported data. Below I’ll go in details on each aspect, and their location in the source code for reference.  

### User Context
User context is 
