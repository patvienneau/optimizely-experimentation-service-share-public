import { useEffect, useState } from 'react';
import { container } from '@embroker/shotwell/core/di';
import { Nullable } from '@embroker/shotwell/core/types';
import { ExperimentationServicePlatforms } from '../../types/enums';
import { ExperimentationTestName } from '../../types/ExperimentationTestName';
import { ExperimentationTest } from '../../types/ExperimentationTest';
import { EmbrokerExperimentationService } from '../../services/EmbrokerExperimentationService';
import { OptimizelyExperimentationService } from '../../services/OptimizelyExperimentationService';

function getExperimentationServiceInstance(platform: ExperimentationServicePlatforms) {
    switch (platform) {
        case ExperimentationServicePlatforms.Embroker: {
            return container.get<EmbrokerExperimentationService>(EmbrokerExperimentationService);
        }
        default: {
            return container.get<OptimizelyExperimentationService>(
                OptimizelyExperimentationService,
            );
        }
    }
}

export function useExperimentationTest(
    experimentationTestName: ExperimentationTestName,
    platform: ExperimentationServicePlatforms = ExperimentationServicePlatforms.Optimizely,
): Nullable<ExperimentationTest> {
    const experimentationService = getExperimentationServiceInstance(platform);

    const [experimentationTest, setExperimentationTest] = useState<Nullable<ExperimentationTest>>(
        experimentationService.getExperimentationTest(experimentationTestName),
    );

    useEffect(() => {
        return experimentationService.subscribe(experimentationTestName, (experimentTest) => {
            setExperimentationTest(experimentTest);
        });
    }, [experimentationTestName, experimentationService]);

    return experimentationTest;
}
