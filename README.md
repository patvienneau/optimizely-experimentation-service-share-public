# Technical Summary

## Optimizely Integration
We interface with Optimizely's JS SDK through a FE service built for our application, in order to provide compatibility with other experimentation tools that are used internally for other uses. This also allows us to provide to our own developers are much more succinct and condensed interface to initiate and trigger experimentation tests, as we want to standardize how we transfer data with the Optimizely service.

## Invocation
We interact with Optimizely directly through our own service on a per-need basis, in order to mould the user experience to the result of the feature flag.  We currently invoke Optimizely through JS invocations, though we’ve also implemented a React hook to adapt the JS invocation interface to be invoked in JSX.

## Optimizely Configuration and Setup
We’ve tried to align our implementation with Optimizely’s suggested practices in order to get the most out of the platform. However, the implemented modules may also be source of issues that are affecting the reported data. Below I’ll go in details on each aspect, and their location in the source code for reference.  
