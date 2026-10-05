#if DEBUG
import MushafCore

extension ReviewStore {
    func loadHistory() async {
        let target = pageNumber
        historyState = .loading
        let result = await api.history(page: target)
        guard target == pageNumber else { return }
        switch result {
        case .success(let transactions):
            history = transactions
            historyState = .idle
        case .failure(let error):
            historyState = .failed(error.messageAr)
        }
    }

    func undo(_ tx: HistoryTransaction) async {
        guard !tx.undone, undoingTransaction == nil else { return }
        let target = pageNumber
        undoingTransaction = tx.txid
        defer { undoingTransaction = nil }
        notice = nil
        switch await api.undo(txid: tx.txid) {
        case .success:
            await reloadSilent()
            await loadHistory()
            liveRefresh(target)
        case .failure(let error):
            notice = error.messageAr
        }
    }
}
#endif
