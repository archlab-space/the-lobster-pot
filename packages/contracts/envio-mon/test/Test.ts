import assert from "assert";
import { 
  TestHelpers,
  Election_BribePerVoteUpdated
} from "generated";
const { MockDb, Election } = TestHelpers;

describe("Election contract BribePerVoteUpdated event tests", () => {
  // Create mock db
  const mockDb = MockDb.createMockDb();

  // Creating mock for Election contract BribePerVoteUpdated event
  const event = Election.BribePerVoteUpdated.createMockEvent({/* It mocks event fields with default values. You can overwrite them if you need */});

  it("Election_BribePerVoteUpdated is created correctly", async () => {
    // Processing the event
    const mockDbUpdated = await Election.BribePerVoteUpdated.processEvent({
      event,
      mockDb,
    });

    // Getting the actual entity from the mock database
    let actualElectionBribePerVoteUpdated = mockDbUpdated.entities.Election_BribePerVoteUpdated.get(
      `${event.chainId}_${event.block.number}_${event.logIndex}`
    );

    // Creating the expected entity
    const expectedElectionBribePerVoteUpdated: Election_BribePerVoteUpdated = {
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      term: event.params.term,
      candidate: event.params.candidate,
      oldBribe: event.params.oldBribe,
      newBribe: event.params.newBribe,
    };
    // Asserting that the entity in the mock database is the same as the expected entity
    assert.deepEqual(actualElectionBribePerVoteUpdated, expectedElectionBribePerVoteUpdated, "Actual ElectionBribePerVoteUpdated should be the same as the expectedElectionBribePerVoteUpdated");
  });
});
