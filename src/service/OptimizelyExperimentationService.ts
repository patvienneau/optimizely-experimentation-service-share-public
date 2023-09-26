import { injectable, inject } from '@embroker/shotwell/core/di';
import { Nullable } from '@embroker/shotwell/core/types';
import { isErr } from '@embroker/shotwell/core/types/Result';
import { UUID } from '@embroker/shotwell/core/types/UUID';
import { hasOwnProp } from '@embroker/shotwell/core/object';
import { DomainEventBus } from '@embroker/shotwell/core/event/DomainEventBus';
import { BaseExperimentationService } from './BaseExperimentationService';
import { ExperimentationService } from '.';
import { getEnvVar } from '../../env';
import { AppContext } from '../../view/AppContext';
import { ExperimentationTestNames } from '../types/enums';
import { ExperimentationTest } from '../types/ExperimentationTest';
import { ExperimentationTestName } from '../types/ExperimentationTestName';
import { hasRole } from '../../userOrg/entities/Session';
import {
    ExperimentationEventNames,
    ExperimentationImpressionEvent,
} from '../types/ExperimentationEvents';
import {
    ExperimentationStore,
    ExperimentationTestSubcriptionCallback,
} from './ExperimentationStore';
import optimizely, {
    Client as OptimizelyClient,
    OptimizelyUserContext,
    enums as OptimizelyEnums,
} from '@optimizely/optimizely-sdk';
import { URI } from '@embroker/shotwell/core/types/URI';

export type ResultPayload = {
    success: boolean;
    reason?: string;
};

export type DecisionPayload = {
    type: string;
    userId: UUID;
    decisionInfo: {
        flagKey: ExperimentationTestNames;
        enabled: boolean;
    };
};

export interface OptimizelyExperimentationService extends ExperimentationService {
    optimizelyClient: Nullable<OptimizelyClient>;
    onReady(): Promise<ResultPayload> | undefined;
}

export interface UserContextAttributes {
    REFERRER_origin: string;
    REFERRER_marketingReferrerPath: string;
    SESSION_isAuthenticated: boolean;
    SESSION_isBroker: boolean;
}

type UserContextAttributeNames = keyof UserContextAttributes;

const defaultUserContextAttributes: UserContextAttributes = {
    REFERRER_origin: '',
    REFERRER_marketingReferrerPath: '',
    SESSION_isAuthenticated: false,
    SESSION_isBroker: false,
};

window.OPTIMIZELY = {
    debug: {
        // Set log level of Optimizely messages, used for debugging.
        setLogLevel: (level: string) => {
            optimizely.setLogLevel(level);
        },
    },
};

@injectable()
export class OptimizelyExperimentationService
    extends BaseExperimentationService
    implements OptimizelyExperimentationService
{
    public optimizelyClient: Nullable<OptimizelyClient>;
    public optimizelyUserContext: Nullable<OptimizelyUserContext> = null;
    private isOptimizelyClientReady = false;
    private readyTimeout = 1000;

    constructor(
        @inject(DomainEventBus) private eventBus: DomainEventBus,
        @inject(ExperimentationStore)
        private experimentationStore: ExperimentationStore,
    ) {
        super();
        const { query } = URI.parse(globalThis.location.href);

        //Initiate Optimizely client
        this.optimizelyClient = optimizely.createInstance({
            sdkKey: getEnvVar('OPTIMIZELY_SDK_KEY'),
            logLevel: optimizely.enums.LOG_LEVEL.ERROR,
        });
        this.optimizelyClient?.onReady({ timeout: this.readyTimeout }).then((result) => {
            this.handleOptimizelyClientOnReady(result);
        });
        this.optimizelyClient?.notificationCenter.addNotificationListener(
            OptimizelyEnums.NOTIFICATION_TYPES.DECISION,
            (event: DecisionPayload) => {
                this.handleOnOptimizelyOnDecision(event);
            },
        );
        this.optimizelyUserContext =
            this.optimizelyClient?.createUserContext(
                this.getDeviceId(),
                defaultUserContextAttributes,
            ) ?? null;

        //Register referrer information to user context
        this.setUserContextAttribute('REFERRER_origin', globalThis.document.referrer);
        this.setUserContextAttribute(
            'REFERRER_marketingReferrerPath',
            decodeURIComponent((query.ph as string) ?? ''),
        );

        //Handle application context change
        this.subscribeToAppContextChange((context) => {
            this.handleAppContextChange(context);
        });

        //Subscribe to GTM events by polling for changes to dataLayer
        const gtmDataLayer = OptimizelyExperimentationService.getGTMDataLayer();
        let previousGtmDataLayer = [];
        if (gtmDataLayer) {
            setInterval(() => {
                if (gtmDataLayer.length !== previousGtmDataLayer.length) {
                    gtmDataLayer
                        .slice(previousGtmDataLayer.length)
                        .filter((dataNode) =>
                            hasOwnProp(dataNode, 'event', (eventName: any) =>
                                eventName.startsWith('em$'),
                            ),
                        )
                        .forEach((eventNode) => this.handleGtmEvent(eventNode));

                    previousGtmDataLayer = [...gtmDataLayer];
                }
            }, 1000);
        }
    }

    private handleOptimizelyClientOnReady(result: ResultPayload) {
        //Source: https://github.com/optimizely/react-sdk/blob/master/src/client.ts#L238
        this.isOptimizelyClientReady = result.success;
    }

    private handleOnOptimizelyOnDecision(event: DecisionPayload) {
        this.eventBus.publish<ExperimentationImpressionEvent>({
            id: UUID.create(),
            createdAt: new Date(Date.now()),
            origin: 'Experimentation',
            name: ExperimentationEventNames.Impression,
            deviceId: event.userId,
            experimentationName: event.decisionInfo.flagKey,
            assignment: event.decisionInfo.enabled ? 1 : 0,
        });
    }

    private handleAppContextChange(appContext: AppContext) {
        const activeSession = appContext.activeSession;

        this.setUserContextAttribute(
            'SESSION_isAuthenticated',
            activeSession.isAuthenticated ?? false,
        );

        this.setUserContextAttribute('SESSION_isBroker', hasRole(activeSession, 'broker') ?? false);
    }

    private handleGtmEvent(eventNode: any) {
        // Note: Sanitize as per Optimizely event registration constraints
        const eventName = eventNode.event.replaceAll('$', '_');

        if (eventName) {
            this.optimizelyUserContext?.trackEvent(eventName);
        }
    }

    private setUserContextAttribute(
        attributeName: UserContextAttributeNames,
        attributeValue: any,
    ): void {
        try {
            this.optimizelyUserContext?.setAttribute(attributeName, attributeValue);
        } catch (e) {
            // TODO: Log error to Optimiizely Logger
        }
    }

    private getDeviceId(): UUID {
        let deviceId = localStorage.getItem('deviceId') as UUID;

        if (!deviceId) {
            deviceId = UUID.create();
            localStorage.setItem('deviceId', deviceId);
        }

        return deviceId;
    }

    public onReady(): Promise<ResultPayload> | undefined {
        return this.optimizelyClient?.onReady();
    }

    public isReady(): boolean {
        return !!this.isOptimizelyClientReady;
    }

    public getExperimentationTest(
        experimentationTestName: ExperimentationTestName,
    ): Nullable<ExperimentationTest> {
        if (!this.isReady()) {
            return null;
        }

        // First, check to see if we have the experiment cached
        const cachedExperimentTest = this.experimentationStore.get(experimentationTestName);
        if (cachedExperimentTest) return cachedExperimentTest;

        // If not cached, retrieve decision and store it in local cache
        const decision = this.optimizelyUserContext?.decide(experimentationTestName);

        if (decision === undefined) return null;

        const experimentationTestResult = ExperimentationTest.create({
            name: experimentationTestName,
            assignment: decision?.enabled ? 1 : 0,
            organizationId: this.getDeviceId(),
        });

        if (isErr(experimentationTestResult)) {
            return null;
        }

        const optimizelyExperimentationTest = experimentationTestResult.value;
        this.experimentationStore.set(experimentationTestName, optimizelyExperimentationTest);

        return optimizelyExperimentationTest;
    }

    public subscribe(
        experimentationTestName: ExperimentationTestName,
        callback: ExperimentationTestSubcriptionCallback,
    ): () => void {
        return this.experimentationStore.subscribe(experimentationTestName, callback);
    }

    private static getGTMDataLayer(): Nullable<Array<any>> {
        if (hasOwnProp(globalThis, 'dataLayer', Array.isArray)) {
            return (globalThis as { [key: string]: any })['dataLayer'] as Array<any>;
        }
        return null;
    }
}
