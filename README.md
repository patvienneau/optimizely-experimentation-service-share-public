# Technical Summary

## Optimizely Integration
We interface with Optimizely's JS SDK through a FE service built for our application, in order to provide compatibility with other experimentation tools that are used internally for other uses. This also allows us to provide to our own developers are much more succinct and condensed interface to initiate and trigger experimentation tests, as we want to standardize how we transfer data with the Optimizely service.

## Problems reported
We are currently experiencing two main problems:
1. A/B test bucket assignment is currently approaching a 40/60 split, rather than an expected 50/50 split.
2. Some tracked events are reporting vastly different numbers on the Optimizely platform than on our other reporting tools.

## Technical Assumptions/Decisions
- Optimizely `userId` is defined as a UUID stored on the browser's local storage.
  - We **wanted** to be able to cover non-authorized flows with A/B testing, so business-defined IDs could not be used
  - We **accept** that a given visitor would be considered as multiple users in the eyes of Optimizely should they use multiple devices/browsers (mobile-switch-to-desktop, for example)
  - We **accept** that local storage is not permanent persistence, and therefore a given user/browser combination may be considered as multiple users in the eyes of Optimizely, should their local storage be cleared.
  - We **assume** that these are low-frequency occurrence scenarios, and would therefore have low impact to downstream reporting.
  - We **assume** that impact would not discriminate in a measurable way in reporting between buckets.
- Optimizely manages test traffic exclusion with data reporting in mind
  - We **assume** that excluded users will not count towards test visitors based on fallback assignment (such as control (`off`) bucket if users are excluded from test).
- A/B test is configured with unique visitors in mind
  - We **wanted** to exclude duplicate data
  - We **assume** that multiple calls to Optimizely for a same `userId` will not increment the reported visitor count, nor the bucket assignment count.
  - We **assume** that multiple registered events dispatched to Optimizely for the same user will not be double counted, if we report on **Unique conversions per visitor**.

## Invocation
We interact with Optimizely directly through our own service on a per-need basis, in order to mould the user experience to the result of the feature flag.  We currently invoke Optimizely through JS invocations, though we’ve also implemented a React hook to adapt the JS invocation interface to be invoked in JSX.

Optimizely is invoked by calling `getExperimentionTest` in our FE service. An example of this can be found through our [implemented React hook](https://github.com/patvienneau/optimizely-experimentation-service-share-public/blob/main/src/hook/useExperimentationTest.ts#L30). Implementation details of our invocation of Optimizely's `decision` function can be found [below](https://github.com/patvienneau/optimizely-experimentation-service-share-public#test-assignment-decision). 

## Optimizely Configuration and Setup
We’ve tried to align our implementation with Optimizely’s suggested practices in order to get the most out of the platform. However, the implemented modules may also be source of issues that are affecting the reported data. Below I’ll go in details on each aspect, and their location in the source code for reference.  

### User Context
User context is leveraged to define [user identification](https://github.com/patvienneau/optimizely-experimentation-service-share-public/blob/main/src/service/OptimizelyExperimentationService.ts#L106-L110), as well as user attributes that help guide test eligibility (both [referrer information](https://github.com/patvienneau/optimizely-experimentation-service-share-public/blob/main/src/service/OptimizelyExperimentationService.ts#L113-L117) and [account attributes](https://github.com/patvienneau/optimizely-experimentation-service-share-public/blob/main/src/service/OptimizelyExperimentationService.ts#L165-L170)). It's **assumed** that updating user context will not reset user identification, as [already-defined `userId`](https://github.com/patvienneau/optimizely-experimentation-service-share-public/blob/main/src/service/OptimizelyExperimentationService.ts#L106-L110) is maintained throughout.

### Notification Center
Notification center is used to [dispatch impression events](https://github.com/patvienneau/optimizely-experimentation-service-share-public/blob/main/src/service/OptimizelyExperimentationService.ts#L100-L105) to our other reporting tools. It's **assumed** that this won't have an impact on Optimizely's assignment and reporting functionality and behaviour.

### Optimizely Event Tracking
We call Optimizely's `trackEvent` function [directly on the user context instance](https://github.com/patvienneau/optimizely-experimentation-service-share-public/blob/main/src/service/OptimizelyExperimentationService.ts#L173-L180). In order to leverage existing tracked events that are managed by GTM to our various reporting platforms, we've implemented a periodic listener to [GTM events](https://github.com/patvienneau/optimizely-experimentation-service-share-public/blob/main/src/service/OptimizelyExperimentationService.ts#L125-L142) in order to transform them to Optimizely tracked events. This should allow us the ability to approach parity between reported stats in Optimizely with our other reporting platforms.

### Test assignment, decision
Flag assignment is completed through the `decision` pattern when the service is [invoked to return experimentation information](https://github.com/patvienneau/optimizely-experimentation-service-share-public/blob/main/src/service/OptimizelyExperimentationService.ts#L212-L242). Internal memory caching is maintained in order to reduce repeating computations by Optimizely and the risk of bloating impression count.
