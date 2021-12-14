/**
 * Reorder
 */
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list)
  const [removed] = result.splice(startIndex, 1)
  result.splice(endIndex, 0, removed)

  return result
}

/**
 * With new item ids
 */
const withNewItemIds = (room, itemIds) => ({
  id: room.id,
  name: room.name,
  itemIds,
})

/**
 * Reorder single drag
 */
const reorderSingleDrag = ({
  data,
  selectedItemIds,
  source,
  destination,
}) => {
  // moving in the same list
  if (source.droppableId === destination.droppableId) {
    const room = data.rooms[data.rooms.findIndex(r => r.id===source.droppableId)]

    const reordered = reorder(room.itemIds, source.index, destination.index)

    data.rooms[data.rooms.findIndex(r => r.id===room.id)] = withNewItemIds(room, reordered)
    const updated = {
      ...data,
      rooms: [...data.rooms],
    }

    return {
      data: updated,
      selectedItemIds,
    }
  }

  // moving to a new list
  const home = data.rooms[data.rooms.findIndex(r => r.id===source.droppableId)]
  const foreign = data.rooms[data.rooms.findIndex(r => r.id===destination.droppableId)]

  // the id of the item to be moved
  const itemId = home.itemIds[source.index]

  // remove from home room
  const newHomeItemIds = [...home.itemIds]
  newHomeItemIds.splice(source.index, 1)

  // add to foreign room
  const newForeignItemIds = [...foreign.itemIds]
  newForeignItemIds.splice(destination.index, 0, itemId)

  data.rooms[data.rooms.findIndex(r => r.id===home.id)] = withNewItemIds(home, newHomeItemIds)
  data.rooms[data.rooms.findIndex(r => r.id===foreign.id)] = withNewItemIds(foreign, newForeignItemIds)
  const updated = {
    ...data,
    rooms: [...data.rooms],
  }

  return {
    data: updated,
    selectedItemIds,
  }
}

/**
 * Get home room
 */
export const getHomeRoom = (data, itemId) => {
  const roomId = data.roomIds.find((id) => {
    const room = data.rooms[data.rooms.findIndex(r => r.id===id)]
    return room.itemIds.includes(itemId)
  })

  return data.rooms[data.rooms.findIndex(r => r.id===roomId)]
}

/**
 * Reorder multi drag
 */
const reorderMultiDrag = ({
  data,
  selectedItemIds,
  source,
  destination,
}) => {
  console.log('- - - - - reorderMultiDrag - - - - -')
  console.log(source)
  const start = data.rooms[data.rooms.findIndex(r => r.id===source.droppableId)]
  const dragged = start.itemIds[source.index]

  const insertAtIndex = (() => {
    const destinationIndexOffset = selectedItemIds.reduce(
      (previous, current) => {
        if (current === dragged) {
          return previous
        }

        const final = data.rooms[data.rooms.findIndex(r => r.id===destination.droppableId)]
        const room = getHomeRoom(data, current)

        if (room !== final) {
          return previous
        }

        const index = room.itemIds.indexOf(current)

        if (index >= destination.index) {
          return previous
        }

        // the selected item is before the destination index
        // we need to account for this when inserting into the new location
        return previous + 1
      },
      0
    )

    const result = destination.index - destinationIndexOffset
    return result
  })()

  // doing the ordering now as we are required to look up rooms
  // and know original ordering
  const orderedSelectedItemIds = [...selectedItemIds]

  orderedSelectedItemIds.sort((a, b) => {
    // moving the dragged item to the top of the list
    if (a === dragged) {
      return -1
    }

    if (b === dragged) {
      return 1
    }

    // sorting by their natural indexes
    const roomForA = getHomeRoom(data, a)
    const indexOfA = roomForA.itemIds.indexOf(a)
    const roomForB = getHomeRoom(data, b)
    const indexOfB = roomForB.itemIds.indexOf(b)

    if (indexOfA !== indexOfB) {
      return indexOfA - indexOfB
    }

    // sorting by their order in the selectedItemIds list
    return -1
  })

  // we need to remove all of the selected items from their rooms
  const withRemovedItems = data.roomIds.reduce((previous, roomId) => {
    console.log('- - - - - withRemovedItems - - - - -');
    const room = data.rooms[data.rooms.findIndex(r => r.id===roomId)]

    // console.log('room')
    // console.log(room)

    // remove the id's of the items that are selected
    const remainingItemIds = room.itemIds.filter(
      (id) => !selectedItemIds.includes(id)
    )
    // console.log('remainingItemIds')
    // console.log(remainingItemIds)

    // console.log('withNewItemIds')
    // console.log(withNewItemIds(room, remainingItemIds))

    // console.log(previous)
    previous[data.rooms.findIndex(r => r.id===room.id)] = withNewItemIds(room, remainingItemIds)
    // console.log(previous)
    return previous
  }, data.rooms)

  console.log('withRemovedItems')
  console.log(withRemovedItems)

  const final = withRemovedItems[data.rooms.findIndex(r => r.id===destination.droppableId)]
  console.log('final')
  console.log(final)

  const withInserted = (() => {
    const base = [...final.itemIds]
    base.splice(insertAtIndex, 0, ...orderedSelectedItemIds)
    return base
  })()

  // insert all selected items into final room
  const addedItems = withNewItemIds(final, withInserted)

  console.log('addedItems')
  console.log(addedItems)
  // const withAddedItems = [
  //   ...withRemovedItems,
  //   addedItems,
  // ]

  const withAddedItems = withRemovedItems
  withAddedItems[data.rooms.findIndex(r => r.id===final.id)] = withAddedItems

  console.log('withAddedItems')
  console.log(withAddedItems)

  const updated = {
    ...data,
    rooms: withAddedItems,
  }

  return {
    data: updated,
    selectedItemIds: orderedSelectedItemIds,
  }
}

/**
 * Mutli drag aware reorder
 */
export const mutliDragAwareReorder = (args) => {
  if (args.selectedItemIds.length > 1) {
    console.log('args')
    console.log(args)
    return reorderMultiDrag(args)
  }
  return reorderSingleDrag(args)
}

/**
 * Multi select to
 */
export const multiSelectTo = (data, selectedItemIds, newItemId) => {
  // Nothing already selected
  if (!selectedItemIds.length) {
    return [newItemId]
  }

  const roomOfNew = getHomeRoom(data, newItemId)
  const indexOfNew = roomOfNew.itemIds.indexOf(newItemId)

  const lastSelected = selectedItemIds[selectedItemIds.length - 1]
  const roomOfLast = getHomeRoom(data, lastSelected)
  const indexOfLast = roomOfLast.itemIds.indexOf(lastSelected)

  // multi selecting to another room
  // select everything up to the index of the current item
  if (roomOfNew !== roomOfLast) {
    return roomOfNew.itemIds.slice(0, indexOfNew + 1)
  }

  // multi selecting in the same room
  // need to select everything between the last index and the current index inclusive

  // nothing to do here
  if (indexOfNew === indexOfLast) {
    return null
  }

  const isSelectingForwards = indexOfNew > indexOfLast
  const start = isSelectingForwards ? indexOfLast : indexOfNew
  const end = isSelectingForwards ? indexOfNew : indexOfLast

  const inBetween = roomOfNew.itemIds.slice(start, end + 1)

  // everything inbetween needs to have it's selection toggled.
  // with the exception of the start and end values which will always be selected

  const toAdd = inBetween.filter((itemId) => {
    // if already selected: then no need to select it again
    if (selectedItemIds.includes(itemId)) {
      return false
    }
    return true
  })

  const sorted = isSelectingForwards ? toAdd : [...toAdd].reverse()
  const combined = [...selectedItemIds, ...sorted]

  return combined
}
