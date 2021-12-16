import React, { useCallback, useEffect, useState } from 'react'
import { Table, Row, Col, Card, Empty } from 'antd'
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd'

import { mutliDragAwareReorder, multiSelectTo as multiSelect } from './utils'

import {
  AiOutlineAudio,
  AiOutlineAudioMuted,
  AiTwotoneEye,
  AiOutlineEyeInvisible,
  AiFillWechat,
  AiFillDelete
} from 'react-icons/ai'

/**
  const dataMock = {
    items: [
      { id: '0', display: 'Item 0' },
      { id: '1', display: 'Item 1' },
      { id: '2', display: 'Item 2' },
      { id: '3', display: 'Item 3' },
      { id: '4', display: 'Item 4' },
      { id: '5', display: 'Item 5' },
    ],
    roomIds: ['room1', 'room2'],
    rooms: [
      {
        id: 'room1',
        title: 'Room 1',
        itemIds: ['0', '1', '2', '3'],
      },
      {
        id: 'room2',
        title: 'Room 2',
        itemIds: ['4', '5'],
      },
    ],
  }
**/

const COLUMN_ID_DONE = 'done'

// https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
const PRIMARY_BUTTON_NUMBER = 0

interface MultiTableDragProps {
  data,
  destroyRoom,
  mute,
  unmute,
  onClickSwitchRoom,
  orderSwitchRoom,
  isGuide,
  selectVideo,
  user
}

const MultiTableDrag: React.FC<MultiTableDragProps> = ({ data, destroyRoom, mute, unmute, onClickSwitchRoom, orderSwitchRoom, isGuide, selectVideo, user }) => {
  // const [entities, setEntities] = useState<any>(data)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [draggingItemId, setDraggingItemId] = useState(null)

  const getTableColumns = () => {
    const columns: any[] = []
    if (data) {
      for (let i = 0; i < data.roomIds.length; i++) {
        columns[i] = [
          {
            title: <>
            <span><AiFillWechat className='room-icon'/></span>
            <span className='room-name' onClick={onClickSwitchRoom}>{data.rooms[i].title}</span>
            </>,
            dataIndex: 'display',
            key: 'id'
          },
          {
            title: () => {
              return (isGuide && !(data.rooms[i].title === 'Hall') && <AiFillDelete className='delete-icon' id={'delete-' + data.rooms[i].id} onClick={destroyRoom}/>)
            },
            key: 'id',
            render: (text, record) => (
              isGuide ? ( record.muted ? ( record.selected ? ( record.id === user.id ? (
                <>
                <AiOutlineAudioMuted className='mute-icon' id={'mute-' + record.id} />
                </>
              ) : (
                <>
                <AiOutlineAudioMuted className='mute-icon' id={'mute-' + record.id} />
                <AiOutlineEyeInvisible className='view-icon' id={'view-' + record.id} onClick={selectVideo} />
                </>
              )
              ) : ( record.id === user.id ? (
                <>
                <AiOutlineAudioMuted className='mute-icon' id={'mute-' + record.id} />
                </>
              ) : (
                <>
                <AiOutlineAudioMuted className='mute-icon' id={'mute-' + record.id} />
                <AiTwotoneEye className='view-icon' id={'view-' + record.id} onClick={selectVideo} />
                </>
              )
              )
              ) : ( record.selected ? ( record.id === user.id ? (
                <>
                <AiOutlineAudio className='mute-icon' id={'mute-' + record.id} onClick={mute} />
                </>
              ) : (
                <>
                <AiOutlineAudio className='mute-icon' id={'mute-' + record.id} onClick={mute} />
                <AiOutlineEyeInvisible className='view-icon' id={'view-' + record.id} onClick={selectVideo} />
                </>
              )
              ) : ( record.id === user.id ? (
                <>
                <AiOutlineAudio className='mute-icon' id={'mute-' + record.id} onClick={mute} />
                </>
              ) : (
                <>
                <AiOutlineAudio className='mute-icon' id={'mute-' + record.id} onClick={mute} />
                <AiTwotoneEye className='view-icon' id={'view-' + record.id} onClick={selectVideo} />
                </>
              )
              )
              )
              ) : ( record.muted ? ( 
                <AiOutlineAudioMuted className='mute-icon' id={'mute-' + record.id} />
              ) : ( 
                <AiOutlineAudio className='mute-icon' id={'mute-' + record.id} />
              )
              )
            ),
          },
        ]
      }
    }
    return columns
  }

  /**
   * On window click
   */
  const onWindowClick = useCallback((e) => {
    if (e.defaultPrevented) {
      return
    }

    setSelectedItemIds([])
  }, [])

  /**
   * On window key down
   */
  const onWindowKeyDown = useCallback((e) => {
    if (e.defaultPrevented) {
      return
    }

    if (e.key === 'Escape') {
      setSelectedItemIds([])
    } else if (e.key === 'v') {
      if (e.repeat) {
        return
     }
      unmute()
    }
  }, [])

   /**
   * On window key up
   */
    const onWindowKeyUp = useCallback((e) => {
      if (e.defaultPrevented) {
        return
      }
  
      if (e.key === 'v') {
        mute()
      }
    }, [])

  /**
   * On window touch end
   */
  const onWindowTouchEnd = useCallback((e) => {
    if (e.defaultPrevented) {
      return
    }

    setSelectedItemIds([])
  }, [])

  /**
   * Event Listener
   */
  useEffect(() => {
    window.addEventListener('click', onWindowClick)
    window.addEventListener('keydown', onWindowKeyDown)
    window.addEventListener('touchend', onWindowTouchEnd)
    window.addEventListener('keyup', onWindowKeyUp)

    return () => {
      window.removeEventListener('click', onWindowClick)
      window.removeEventListener('keydown', onWindowKeyDown)
      window.removeEventListener('touchend', onWindowTouchEnd)
      window.removeEventListener('keyup', onWindowKeyUp)
    }
  }, [onWindowClick, onWindowKeyDown, onWindowTouchEnd])

  /**
   * Droppable table body
   */
  const DroppableTableBody = ({ roomId, items, ...props }) => {
    return (
      <Droppable
        droppableId={roomId}
        // isDropDisabled={roomId === 'todo'}
      >
        {(provided, snapshot) => (
          <tbody
            ref={provided.innerRef}
            {...props}
            {...provided.droppableProps}
            className={`${props.className} ${
              snapshot.isDraggingOver && roomId === COLUMN_ID_DONE
                ? 'is-dragging-over'
                : ''
            }`}
          ></tbody>
        )}
      </Droppable>
    )
  }

  /**
   * Draggable table row
   */
  const DraggableTableRow = ({ index, record, roomId, items, ...props }) => {
    if (!items.length) {
      return (
        <tr className="ant-table-placeholder row-item" {...props}>
          <td colSpan={getTableColumns().length} className="ant-table-cell">
            <div className="ant-empty ant-empty-normal">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          </td>
        </tr>
      )
    }

    const isSelected = selectedItemIds.some(
      (selectedItemId) => selectedItemId === record.id
    )
    const isGhosting =
      isSelected && Boolean(draggingItemId) && draggingItemId !== record.id

    return (
      <Draggable
        key={props['data-row-key']}
        draggableId={props['data-row-key'].toString()}
        index={index}
      >
        {(provided, snapshot) => {
          return (
            <tr
              ref={provided.innerRef}
              {...props}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
              className={`row-item ${isSelected ? 'row-selected' : ''} ${
                isGhosting ? 'row-ghosting' : ''
              } ${snapshot.isDragging ? 'row-dragging' : ''}`}
              // onClick={onClick}
              // onTouchEnd={onTouchEnd}
              // onKeyDown={event => onKeyDown(event, provided, snapshot)}
            ></tr>
          )
        }}
      </Draggable>
    )
  }

  /**
   * Get items
   */
  const getItems = (data, id) => {
    return data.rooms[id].itemIds.map((itemId) =>
      data.items.find((item) => item.id === itemId)
    )
  }

  /**
   * On before capture
   */
  const onBeforeCapture = (start) => {
    console.log('onBeforeCapture',start)
    const draggableId = start.draggableId
    const selected = selectedItemIds.find((itemId) => itemId === draggableId)

    // if dragging an item that is not selected - unselect all items
    if (!selected) {
      setSelectedItemIds([])
    }

    setDraggingItemId(draggableId)
  }

  /**
   * On drag end
   */
  const onDragEnd = (result) => {
    const destination = result.destination
    const source = result.source

    // nothing to do
    if (!destination || result.reason === 'CANCEL') {
      setDraggingItemId(null)
      return
    }
    
    const processed = mutliDragAwareReorder({
      data,
      selectedItemIds,
      source,
      destination,
    })

    console.log('onDragEnd', processed)
    orderSwitchRoom(draggingItemId, source, destination)
    setDraggingItemId(null)
  }

  /**
   * Toggle selection
   */
  const toggleSelection = (itemId: string) => {
    console.log('toggleSelection')

    const wasSelected = selectedItemIds.includes(itemId)

    const newItemIds = (() => {
      // Item was not previously selected
      // now will be the only selected item
      if (!wasSelected) {
        return [itemId]
      }

      // Item was part of a selected group
      // will now become the only selected item
      if (selectedItemIds.length > 1) {
        return [itemId]
      }

      // item was previously selected but not in a group
      // we will now clear the selection
      return []
    })()
    setSelectedItemIds(newItemIds)
  }

  /**
   * Toggle selection in group
   */
  const toggleSelectionInGroup = (itemId) => {
    const index = selectedItemIds.indexOf(itemId)

    // if not selected - add it to the selected items
    if (index === -1) {
      setSelectedItemIds([...selectedItemIds, itemId])

      return
    }

    // it was previously selected and now needs to be removed from the group
    const shallow = [...selectedItemIds]
    shallow.splice(index, 1)
    setSelectedItemIds(shallow)
  }

  /**
   * Multi select to
   * This behaviour matches the MacOSX finder selection
   */
  const multiSelectTo = (newItemId) => {
    const updated = multiSelect(data, selectedItemIds, newItemId)

    if (updated == null) {
      return
    }

    setSelectedItemIds(updated)
  }

  /**
   * On click to row
   * Using onClick as it will be correctly
   * preventing if there was a drag
   */
  const onClickRow = (e, record) => {
    console.log('onClickRow')
    if (e.defaultPrevented) {
      return
    }

    if (e.button !== PRIMARY_BUTTON_NUMBER) {
      return
    }

    // marking the event as used
    e.preventDefault()
    // performAction(e, record) // selection disabled
  }

  /**
   * On touch end from row
   */
  const onTouchEndRow = (e, record) => {
    if (e.defaultPrevented) {
      return
    }

    // marking the event as used
    // we would also need to add some extra logic to prevent the click
    // if this element was an anchor
    e.preventDefault()
    toggleSelectionInGroup(record.id)
  }

  /**
   * Was toggle in selection group key used
   * Determines if the platform specific toggle selection in group key was used
   */
  const wasToggleInSelectionGroupKeyUsed = (e) => {
    const isUsingWindows = navigator.platform.indexOf('Win') >= 0
    return isUsingWindows ? e.ctrlKey : e.metaKey
  }

  /**
   * Was multi select key used
   * Determines if the multiSelect key was used
   */
  const wasMultiSelectKeyUsed = (e) => e.shiftKey

  /**
   * Perform action
   */
  const performAction = (e, record) => {
    if (wasToggleInSelectionGroupKeyUsed(e)) {
      toggleSelectionInGroup(record.id)
      return
    }

    if (wasMultiSelectKeyUsed(e)) {
      multiSelectTo(record.id)
      return
    }

    toggleSelection(record.id)
  }

  return (
    <>
      <Card
        className={`c-multi-drag-table ${draggingItemId ? 'is-dragging' : ''}`}
      >
        <DragDropContext
          onBeforeCapture={onBeforeCapture}
          onDragEnd={onDragEnd}
        >
          <Row gutter={40}>
            {data.rooms.map((room) => {
              return (
                <Col key={room.id} xs={12}>
                  <div className="inner-col">
                    <Table
                      dataSource={getItems(
                        data,
                        data.rooms.findIndex((r) => r.id === room.id)
                      )}
                      columns={
                        getTableColumns()[
                          data.rooms.findIndex((r) => r.id === room.id)
                        ]
                      }
                      rowKey="id"
                      pagination={false}
                      components={{
                        body: {
                          // Custom tbody
                          wrapper: (val) =>
                            DroppableTableBody({
                              roomId: room.id,
                              items: getItems(
                                data,
                                data.rooms.findIndex(
                                  (r) => r.id === room.id
                                )
                              ),
                              ...val,
                            }),
                          // Custom td
                          row: (val) =>
                            DraggableTableRow({
                              items: getItems(
                                data,
                                data.rooms.findIndex(
                                  (r) => r.id === room.id
                                )
                              ),
                              ...val,
                            }),
                        },
                      }}
                      // Set props on per row (td)
                      onRow={(record, index) => ({
                        index,
                        record,
                        onClick: (e) => onClickRow(e, record),
                        onTouchEnd: (e) => onTouchEndRow(e, record),
                      })}
                    />
                  </div>
                </Col>
              )
            })}
          </Row>
          <br />
        </DragDropContext>
      </Card>
    </>
  )
}

export default MultiTableDrag
