import {
    all,
    put,
    call,
    cancelled,
    select,
    takeEvery,
    takeLatest,
} from 'redux-saga/effects';
import {
    FETCH_START,
    FETCH_END,
    FETCH_ERROR,
    FETCH_CANCEL,
} from '../../actions/fetchActions';

const crudFetch = dataProvider => {
    function* handleFetch(action) {
        const isOptimistic = yield select(state => state.admin.ui.optimistic);
        if (isOptimistic) {
            // in optimistic mode, all fetch actions are canceled,
            // so the admin uses the store without synchronization
            return;
        }
        const { type, payload, meta: { fetch: fetchMeta, ...meta } } = action;
        const restType = fetchMeta;

        yield all([
            put({ type: `${type}_LOADING`, payload, meta }),
            put({ type: FETCH_START }),
        ]);
        let response;
        try {
            response = yield call(
                dataProvider,
                restType,
                meta.resource,
                payload
            );
            if (!response.data) {
                throw new Error('REST response must contain a data key');
            }
            yield put({
                type: `${type}_SUCCESS`,
                payload: response,
                requestPayload: payload,
                meta: {
                    ...meta,
                    fetchResponse: restType,
                    fetchStatus: FETCH_END,
                },
            });
            yield put({ type: FETCH_END });
        } catch (error) {
            yield put({
                type: `${type}_FAILURE`,
                error: error.message ? error.message : error,
                payload: error.body ? error.body : null,
                requestPayload: payload,
                meta: {
                    ...meta,
                    fetchResponse: restType,
                    fetchStatus: FETCH_ERROR,
                },
            });
            yield put({ type: FETCH_ERROR, error });
        } finally {
            if (yield cancelled()) {
                yield put({ type: FETCH_CANCEL });
                return; /* eslint no-unsafe-finally:0 */
            }
        }
    }

    return function* watchCrudFetch() {
        yield all([
            takeLatest(
                action =>
                    action.meta &&
                    action.meta.fetch &&
                    action.meta.cancelPrevious,
                handleFetch
            ),
            takeEvery(
                action =>
                    action.meta &&
                    action.meta.fetch &&
                    !action.meta.cancelPrevious,
                handleFetch
            ),
        ]);
    };
};

export default crudFetch;
