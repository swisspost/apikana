import { DateTime } from 'apikana/default-types'
import { Pet } from './pet'

export interface PetEvent {
    /**
     * When the event occured.
     */
    timestamp: DateTime

    /**
     * Event field set for an adoption.
     */
    adopted: {
        pet: Pet

        /**
         * Who adopted the pet.
         */
        owner: string
    }

    /**
     * Event field set when a pet was lost.
     */
    lost: {
        pet: Pet

        /**
         * Where the pet has been seen the last time.
         */
        location: string
    }
}
